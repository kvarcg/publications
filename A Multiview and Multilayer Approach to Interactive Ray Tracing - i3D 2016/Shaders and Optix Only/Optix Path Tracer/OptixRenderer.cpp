#include "OptixRenderer.h"

using namespace std;
using namespace optix;

float3 OptixRenderer::m_default_color			= make_float3(1.0f, 1.0f, 1.0f);
float3 OptixRenderer::m_exception_color			= make_float3(0.0f, 0.0f, 0.0f);
float3 OptixRenderer::m_background_color		= make_float3(0.0f, 0.0f, 0.0f);

string OptixRenderer::SpatialDataStructures[]	= { "Trbvh", "Sbvh", "MedianBvh", "Lbvh", "BvhCompact", "Bvh", "TriangleKdTree", "KdTree", "NoAccel" };
string OptixRenderer::ShadingModels[]			= { "closest_hit_radiance_normal", "closest_hit_radiance_lambertian", "closest_hit_radiance_phong" };
string OptixRenderer::ShadowingModels[]			= { "any_hit_shadow", "any_hit_shadow_transparent" };
string OptixRenderer::CameraTypes[]				= { "pinhole_camera", "orthographic_camera", };

void OptixRenderer::initScene(InitialCameraData&	camera_data)
{
	initContext();
	initRayPrograms();
	initLighting();
	initGeometry();
	initCamera(camera_data);
	finalize();
}

void OptixRenderer::initContext()
{
	m_context->setPrintEnabled(true);			// Enable printing
	m_context->setStackSize(1024);				// Max stack size
	m_context->setRayTypeCount(2);				// Two Rays: (1. Radiance_ray - 2. Shadow Ray) - or (path tracing)
	m_context->setEntryPointCount(1);			// Single Ray Generation Program (= pinhole_camera)

	// Setup output buffer
	m_context["output_buffer"]->set(createOutputBuffer(RT_FORMAT_FLOAT4, m_width, m_height));
	m_context["scene_epsilon"]->setFloat(1.e-3f);
	m_context["max_depth"]->setInt(m_bounces);	// Max Bounces

	m_context["pt::radiance_ray_type"]->setUint(0);
	m_context["pt::shadow_ray_type"]->setUint(1);

	m_context["pt::frame_number"]->setUint(1);
	m_context["pt::sqrt_num_samples"]->setUint(m_sqrt_num_samples);
}

void OptixRenderer::initRayPrograms()
{
	string ptx_camera_path	= ptxpath("cuda", "camera.cu");

	// Ray generation program
	string camera_name = getCameraType(m_camera_type);
	Program ray_gen_program = m_context->createProgramFromPTXFile(ptx_camera_path, camera_name);
	m_context->setRayGenerationProgram(0, ray_gen_program);

	// Miss program
	string miss_name = (m_envmap_enabled) ? "envmap_miss" : "background_miss";
	Program miss_program = m_context->createProgramFromPTXFile(ptx_camera_path, miss_name);
	m_context->setMissProgram(0, miss_program);

	if (m_envmap_enabled)
		m_context["color::envmap"]->setTextureSampler(loadTexture(m_context, texpath("CedarCity.hdr"), m_default_color));
	else
		m_context["color::background"]->setFloat(m_background_color);

	// Exception program
	Program exception_program = m_context->createProgramFromPTXFile(ptx_camera_path, "exception");
	m_context->setExceptionProgram(0, exception_program);
	m_context["color::exception"]->setFloat(m_exception_color);
}

void OptixRenderer::initCamera(InitialCameraData&	camera_data)
{
  // Set up camera
  float max_dim  = m_model_aabb.maxExtent();
  float3 eye	 = m_model_aabb.center();
  eye.z         += 2.0f * max_dim;

  float3 lookat  = m_model_aabb.center();

  // Sponza
  if (m_model_name == "sponza.obj")
  {
	  eye = make_float3(-1.0f, 1.5f, 4.0f);
	  lookat = make_float3(-0.835098f, 1.771803f, 3.051880f);
  }
  else if (m_model_name == "ruins.obj")
  {
	  eye = make_float3(-12.709822f, 2.071503f, 4.993989f);
	  lookat = make_float3(-11.770233f, 2.006715f, 4.657871f);
  }

  camera_data = InitialCameraData(	eye,                             // eye
									lookat,							 // lookat
									make_float3( 0.0f, 1.0f, 0.0f ), // up
									m_fov );                         // vfov

  // Declare camera variables.  The values do not matter, they will be overwritten in trace.
  m_context["camera::eye"]->setFloat(make_float3(0.0f, 0.0f, 0.0f));
  m_context["camera::U"]->setFloat(make_float3(0.0f, 0.0f, 0.0f));
  m_context["camera::V"]->setFloat(make_float3(0.0f, 0.0f, 0.0f));
  m_context["camera::W"]->setFloat(make_float3(0.0f, 0.0f, 0.0f));

}

void OptixRenderer::initLighting()
{
	m_ambient_light_color = make_float3(0.0f, 0.0f, 0.0f);

	BasicLight lights[] = 
	{
		//Sponza
		{ 
			make_float4(5.0f, 40.0f, 0.0f, 1.0f), 
			make_float3(0.0f, 20.0f, 0.0f), 50.0f,
			make_float3(0.79f, 0.879f, 1.0f), 5000.0f, 
			m_shadows_enabled ? 1 : 0 
		}

		//Ruins
		//{ 
		//	make_float4(400.0f, 400.0f, 100.0f, 1.0f),
		//	make_float3(0.0f, 0.0f, 0.0f), 7.0f,
		//	make_float3(0.79f, 0.879f, 1.0f), 500000.0f, 
		//	m_shadows_enabled ? 1 : 0 
		//}
	};

	m_light_buffer = m_context->createBuffer(RT_BUFFER_INPUT);
	m_light_buffer->setFormat(RT_FORMAT_USER);
	m_light_buffer->setElementSize(sizeof(BasicLight));
	m_light_buffer->setSize(sizeof(lights) / sizeof(BasicLight));
	memcpy(m_light_buffer->map(), lights, sizeof(lights));
	m_light_buffer->unmap();

	m_context["lights"]->set(m_light_buffer);
	m_context["ambient_light_color"]->setFloat(m_ambient_light_color);
	m_context["importance_cutoff"]->setFloat(0.01f);
}

void OptixRenderer::initGeometry()
{
	m_geometry_group		= m_context->createGeometryGroup();
	m_accel_desc.builder	= getSpatialDataStructure(m_sds_builder).c_str();
	m_accel_desc.traverser	= getSpatialDataStructure(m_sds_traverser).c_str();
	{
		initModel();
	}
	m_context["top_object"]->set(m_geometry_group);
	m_context["top_shadower"]->set(m_geometry_group);
}

void OptixRenderer::initModel()
{
	string m_model_path = "/data/" + m_model_name;
	OptiXMesh loader(m_context, m_geometry_group, m_accel_desc);

	loader.loadBegin_Geometry(m_model_path);
	{
		m_model_aabb = loader.getSceneBBox();
	}
	loader.loadFinish_Materials();

	initFloor();
}

void OptixRenderer::finalize()
{
	// Prepare to run
	m_context->validate();

	double start, end_compile, end_AS_build;
	sutilCurrentTime(&start);
	{
		m_context->compile();
	}
	sutilCurrentTime(&end_compile);
	{
		m_context->launch(0, 0);
	}
	sutilCurrentTime(&end_AS_build);
	cout << "Time to AS CACHING     : " << end_AS_build - end_compile << " s.\n";
	cout << "Time to compile kernel : " << end_compile - start << " s.\n";
}

void OptixRenderer::trace   (const RayGenCameraData&	camera_data )
{
	//Set Camera View
	m_context["camera::eye"]->setFloat	( camera_data.eye	);
	m_context["camera::U"]->setFloat	( camera_data.U		);
	m_context["camera::V"]->setFloat	( camera_data.V		);
	m_context["camera::W"]->setFloat	( camera_data.W		);

	if (m_camera_changed)
	{
		m_camera_changed = false;
		m_frame = 1;
	}
	m_context["pt::frame_number"]->setUint(m_frame++);
	getOutputBuffer()->getSize(m_width, m_height);
	m_context->launch(0, static_cast<unsigned int>(m_width),
		static_cast<unsigned int>(m_height));
}

void	printUsageAndExit( const string& argv0, bool doExit = true )
{
  cerr
    << "Usage  : " << argv0 << " [options]\n"
    << "App options:\n"
    << "  -h  | --help                               Print this usage message\n"
    << "  -t  | --texture-path <path>                Specify path to texture directory\n"
    << "        --dim=<width>x<height>               Set image dimensions\n"
    << endl;
  GLUTDisplay::printUsage();

  if ( doExit ) exit(1);
}

int		main			 ( int argc, char** argv )
{
	GLUTDisplay::init( argc, argv );
		
	unsigned int	width  = 1024u, height = 768u;
	
	string		texture_path;
	for ( int i = 1; i < argc; ++i )
	{
	    string arg( argv[i] );
		if ( arg == "--help" || arg == "-h" )					printUsageAndExit( argv[0] );
		else if ( arg.substr( 0, 6 ) == "--dim=" )
		{
			string dims_arg = arg.substr(6);
			if ( sutilParseImageDimensions( dims_arg.c_str(), &width, &height ) != RT_SUCCESS )
			{
				cerr << "Invalid window dimensions: '" << dims_arg << "'" << endl;
																printUsageAndExit( argv[0] );
			}
		}
		else if (arg == "-t" || arg == "--texture-path")
		{
			if ( i == argc-1 ) 									printUsageAndExit( argv[0] );
			texture_path = argv[++i];
		}
		else
		{
			cerr << "Unknown option: '" << arg << "'\n";	printUsageAndExit( argv[0] );
		}
	}

	if (texture_path.empty())
		texture_path = string(sutilSamplesDir()) + "/tutorial/data";

	if(!GLUTDisplay::isBenchmark())
		printUsageAndExit( argv[0], false );
	
	try
	{
		OptixRenderer scene(texture_path, width, height);

		GLUTDisplay::setUseSRGB(true);
		GLUTDisplay::run("Tutorial", &scene);
	}
	catch( Exception& e )
	{
		sutilReportError( e.getErrorString().c_str() );
		exit(1);
	}
	
	return 0;
}