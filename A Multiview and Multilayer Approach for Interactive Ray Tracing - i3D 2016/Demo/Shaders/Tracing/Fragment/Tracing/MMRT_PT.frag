// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation of a basic Path Tracer
// which performs ray tracing in screen-space, either linearly or hierarchically 
// through the single- or multi-view structure

#include "version.h"
#include "MMRT/MMRT_data_structs.glsl"
#include "trace_define.h"

in vec2 TexCoord;		// uv coordinates

#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1
#define NUM_MEMORY_CUBEMAPS		__NUM_FACES__

layout(binding = 0, rgba32f)	coherent	uniform image2D			image_result;			// stores the final result

// image bindings
layout(binding = 3, r32ui )	readonly uniform uimage2DArray  image_head_tail;				// stored head pointers per view and per bucket and then tail pointers in the same manner
layout(binding = 4, std430)	readonly buffer  LL_DATA	 { NodeTypeData			data []; };	// the Data buffer
layout(binding = 5, std430)	readonly buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; }; // the ID buffer
layout(binding = 11) uniform sampler2DArray tex_depth_bounds;								// the depth bounds
	
uint  getPixelHeadID	(const ivec3 coords)	{ return imageLoad (image_head_tail, ivec3(coords)).r;} // retrieve the head ID for a bucket
uint  getPixelTailID	(const ivec3 coords)	{ return imageLoad (image_head_tail, ivec3(coords.xy, coords.z + BUCKET_SIZE*NUM_MEMORY_CUBEMAPS)).r;} // retrieve the tail ID for a bucket

#define __HIZ_MARCHING_ENABLED__
#define __RAY_PREVIEW__
#ifdef RAY_PREVIEW_ENABLED
#ifdef HIZ_MARCHING
#define TRACE_HIZ_DEBUG
#endif // HIZ_MARCHING
layout(binding = 1, rgba32f)	coherent	uniform image2DArray	image_ray_positions;
#define RAY_OFFSET_LAYER 1
void storeRay	(ivec3 coords, const vec4 value)	{ imageStore (image_ray_positions, ivec3(coords.xy, coords.z + RAY_OFFSET_LAYER), value); }
vec4 loadRay    (ivec3 coords     			 )		{ return imageLoad (image_ray_positions, ivec3(coords.xy, coords.z + RAY_OFFSET_LAYER));}
ivec2 debug_buffer_size;
bool isDebugFragment()								{ return (ivec2(gl_FragCoord.xy) == ivec2(debug_buffer_size.xy*0.5)); }
#endif // RAY_PREVIEW
#define __TEST_RAYS__

#ifdef STATISTICS
layout(binding = 2, rgba32f)	coherent	uniform image2D			image_ray_test_data;
#endif // STATISTICS

#define BOUNCES __BOUNCES__
#define NUM_CUBEMAPS __NUM_FACES__
#define UNLIMITED_RAY_DISTANCE
#define __SINGLE_LAYER__
#define __FRAGMENT_VISUALIZATION__
//#define LAMBERT_ONLY

#define MAX_FACE_LAYERS NUM_CUBEMAPS
#ifdef LAYER_VISUALIZATION
#undef FACE_VISUALIZATION
#undef NUM_CUBEMAPS
//#undef RAY_DISTANCE
#define NUM_CUBEMAPS 1
#define UNLIMITED_RAY_DISTANCE
//#undef EARLY_SKIP
//#define SINGLE_LAYER
#endif
uniform vec3 uniform_background_color;						// background color
uniform mat4 uniform_view[NUM_CUBEMAPS];					// world->view transformation for all views 
uniform mat4 uniform_view_inverse[NUM_CUBEMAPS];			// view->world transformation for all views 
uniform mat4 uniform_proj[NUM_CUBEMAPS];					// view->projection transformation for all views 
uniform mat4 uniform_proj_inverse[NUM_CUBEMAPS];			// projection->view transformation for all views 
uniform mat4 uniform_pixel_proj[NUM_CUBEMAPS];				// view->pixel transformation for all views 
uniform mat4 uniform_pixel_proj_inverse[NUM_CUBEMAPS];		// pixel->view transformation for all views 
uniform float uniform_scene_length;							// the scene's diagonal
uniform vec2 uniform_near_far[NUM_CUBEMAPS];				// near far clipping distance for all views
uniform vec3 uniform_clip_info[NUM_CUBEMAPS];				// projection variables to convert eyeZ -> projZ
uniform vec2 uniform_viewports[NUM_CUBEMAPS];				// object->eye transformation for all views 
uniform ivec4 uniform_viewport_edges[NUM_CUBEMAPS];			// viewport edges
uniform float uniform_progressive_sample;					// time variable
uniform float uniform_time;									// current sample for progressive rendering
uniform int uniform_blend;									// blend coefficients for iterative/progressive rendering
uniform int uniform_lod_max;								// the maximum lod of the depth texture (used during HiZ)

uniform mat4 uniform_light_view;							// spotlight information for illumination calculations
uniform mat4 uniform_light_projection;						// and shadow mapping
uniform mat4 uniform_light_projection_inverse;
uniform vec3 uniform_light_color;
uniform vec3 uniform_light_position;
uniform vec3 uniform_light_direction;
uniform int uniform_light_is_conical;
uniform float uniform_light_cosine_umbra;
uniform float uniform_light_cosine_penumbra;
uniform float uniform_light_spotlight_exponent;
uniform float uniform_light_size;
uniform float uniform_light_shadow_map_resolution;
uniform bool uniform_light_shadows_enabled;
uniform float uniform_light_constant_bias;
uniform vec2 uniform_light_pcf_samples[16];
uniform sampler2D sampler_rsm_depth;

// basic lib for transformations and RNG
#include "MMRT/MMRT_basic_lib.glsl"
// vertex creation
#include "MMRT/MMRT_vertex.glsl"
#ifdef HIZ_MARCHING
// per pixel abuffer tracing
#include "MMRT/MMRT_abuffer_cubemap_hiz.glsl"
// view tracing
#include "MMRT/MMRT_tracing_hiz.glsl"
#else
// per pixel abuffer tracing
#include "MMRT/MMRT_abuffer_cubemap_linear.glsl"
// view tracing
#include "MMRT/MMRT_tracing_linear.glsl"
#endif // HIZ_MARCHING
// lighting and sampling calculations
#define PATH_TRACING
#include "MMRT/MMRT_lighting.glsl"

bool isSkyBox(float emission)
{
	// HACK: large emission is the sky
	return (emission > 30.0);
}

// adds the color for each path
// Parameters:
// - final_color, the final color of the current path
void store_color(vec3 final_color)
{
	// iterative
	vec4 stored_color = vec4(0.0);
	float total_samples = 1;
	if (uniform_blend == 1)
	{
    	stored_color = imageLoad(image_result, ivec2(gl_FragCoord.xy));
		total_samples += stored_color.a;
	}
	final_color.xyz = final_color.xyz + stored_color.xyz * stored_color.a;
	final_color.xyz /= (total_samples);
	
	imageStore(image_result, ivec2(gl_FragCoord.xy), vec4(final_color.xyz, total_samples));
}

void main(void)
{
	vec3 background = vec3(uniform_background_color);
	vec2 current_vertex_coords = gl_FragCoord.xy;

	// if no fragments, return
	bool isEmpty = isABufferEmpty(ivec2(current_vertex_coords.xy));
	if(isEmpty)
	{
		store_color(background.rgb);
		return;
	}
	
#ifdef RAY_PREVIEW_ENABLED
	debug_buffer_size = imageSize(image_result).xy;
#endif

	vec4 final_color = vec4(0,0,0,1);
	vec2 hitPixel = vec2(-2.0, -2.0);
	int	 layer = 0;	
	int result = ABUFFER_FACE_NO_HIT_EXIT;
	bool has_hit = false;

	vec3 point_transport_operators				= vec3(1.0);
	float point_transport_inverse_probabilities = 1.0;

	// slightly offset the starting ray position to perform antialiasing at no extra cost during progressive rendering
#ifdef PIXEL_ANTIALIASING
		vec2 seed = TexCoord.xy * 17 * (uniform_progressive_sample * 0.1);	
		vec2 pixel_antialiasing_offset = rand2n(seed) - 0.5;
		current_vertex_coords.xy = gl_FragCoord.xy + pixel_antialiasing_offset;
#endif // PIXEL_ANTIALIASING

	uint current_vertex_coords_id = getPixelHeadID(ivec3(current_vertex_coords.xy, 0));

	// the current position
	Vertex current_vertex						= createVertex(current_vertex_coords, current_vertex_coords_id, 0
#ifdef LAYER_VISUALIZATION
	, 0
#endif // LAYER_VISUALIZATION
);
#if NUM_CUBEMAPS > 1
	current_vertex.face = 1;
#endif

	// HACK: large emission is the sky
	if (isSkyBox(current_vertex.color.a))
	{
		store_color(current_vertex.color.xyz);
		return;
	}
	Vertex new_vertex;
	
	// the camera
	vec3 prev_vertex_position_ecs = vec3(0);
	
	vec3 light_color_intensity = uniform_light_color;
	vec3 light_position_ecs = uniform_light_position;
	vec3 light_dir_ecs = uniform_light_direction;

	// calculate direct lighting
	// connect vertex to light (for direct lighting)	
	// check spotlight cutoff between light-to-vertex and spotlight direction
	vec3 current_vertex_to_light_direction_ecs	= light_position_ecs - current_vertex.position;
	float current_vertex_to_light_dist2			= dot(current_vertex_to_light_direction_ecs, current_vertex_to_light_direction_ecs);
	current_vertex_to_light_direction_ecs		= normalize(current_vertex_to_light_direction_ecs);
	float spoteffect = check_spotlight(current_vertex_to_light_direction_ecs);	
	float in_shadow = shadow(current_vertex.position) * spoteffect;
	// if we didnt hit an object, we hit the light source
	if (in_shadow > 0.0)
	{
		vec3 current_vertex_to_prev_direction_ecs	= prev_vertex_position_ecs - current_vertex.position;
		current_vertex_to_prev_direction_ecs		= normalize(current_vertex_to_prev_direction_ecs);

#ifdef LAMBERT_ONLY
		vec3 current_vertex_to_light_brdf			= Lambert_BRDF(current_vertex); 
#else
		vec3 current_vertex_to_light_brdf			= Microfacet_Lambert_BSDF(current_vertex_to_light_direction_ecs.xyz, current_vertex_to_prev_direction_ecs.xyz, current_vertex);
#endif // LAMBERT_ONLY
		float current_vertex_to_light_geom			= getGeometricTermPointLightSource(current_vertex_to_light_direction_ecs, current_vertex);
		vec3 current_vertex_to_light_transport_operator = current_vertex_to_light_brdf * current_vertex_to_light_geom * in_shadow;
			
#if !defined (FACE_VISUALIZATION) && !defined (LAYER_VISUALIZATION)
		final_color.xyz								= current_vertex_to_light_transport_operator * light_color_intensity / current_vertex_to_light_dist2;
#endif // FACE_VISUALIZATION || LAYER_VISUALIZATION
	}		

#if !defined (FACE_VISUALIZATION) && !defined (LAYER_VISUALIZATION)
	// emission
	final_color.xyz	+= current_vertex.color.rgb * current_vertex.color.a;
#endif // FACE_VISUALIZATION || LAYER_VISUALIZATION
	
	bool hitSkybox = false;
	vec4 probabilities;
	int bounce = 1;
	vec3 current_vertex_sample_dir = vec3(0);
	for (bounce = 1; bounce <= BOUNCES; bounce++)
	{
		// trace to find a new vertex
		bool transmission = false;
		vec2 seed = getSamplingSeed(bounce);
		float r = rand1n(seed);
		float current_vertex_to_next_inverse_probability = 1.0;

		// generate a new sampling direction based on the fragments's BSDF properties
		// and retrieve the probability as well
		// default BSDF sampling for all rays of for TEST_GLOSSY_RAYS
#if !defined (TEST_DIFFUSE_RAYS) && !defined (TEST_VISIBILITY_RAYS) && !defined (TEST_REFLECTION_RAYS)
		current_vertex_sample_dir = getNewSamplePositionNDFSampling(current_vertex_to_next_inverse_probability, prev_vertex_position_ecs, current_vertex, bounce, transmission);
		current_vertex.transmission = transmission;
#endif // TEST_DIFFUSE_RAYS

		// sampling for TEST_REFLECTION_RAYS
#ifdef TEST_REFLECTION_RAYS
		current_vertex_to_next_inverse_probability = 1.0;
		vec3 I = normalize(current_vertex.position - prev_vertex_position_ecs);
		current_vertex_sample_dir = reflect(I, current_vertex.normal);
#endif // TEST_REFLECTION_RAYS

		// sampling for TEST_VISIBILITY_RAYS
#ifdef TEST_VISIBILITY_RAYS
		current_vertex_to_next_inverse_probability = 1.0;
		current_vertex_sample_dir = normalize(current_vertex.position - vec3(100000,100000,100000));
#endif//  TEST_VISIBILITY_RAYS

		// cosine sampling for TEST_DIFFUSE_RAYS
#ifdef TEST_DIFFUSE_RAYS
		current_vertex_sample_dir = getNewSamplePositionCosineHemisphereSampling(current_vertex_to_next_inverse_probability, current_vertex, r.x * 2.0 * pi, bounce);
#endif // TEST_DIFFUSE_RAYS

		// trace the scene and find a new vertex position
		// if there is a hit, the returned vertex is created
		float jitter = r.x * 0.5 + 0.5;
		has_hit = traceScreenSpaceRay_abuffer(current_vertex.position, current_vertex_sample_dir, jitter, current_vertex.face, result, new_vertex);

#if defined (FACE_VISUALIZATION)
		if (has_hit)
		{
			vec3 heatmap_hsl = vec3(0.0, 1.0, 1.0);
			float counter_norm = clamp(new_vertex.face / 6.0, 0.0, 1.0);
			heatmap_hsl.r = mix(240, 0, counter_norm);
			final_color.xyz = hsv2rgb(heatmap_hsl);
		}
#elif defined (LAYER_VISUALIZATION)
		if (has_hit)
		{
			vec3 heatmap_hsl = vec3(0.0, 1.0, 1.0);
			float counter_norm = clamp(new_vertex.depth_layer / 4.0, 0.0, 1.0);
			heatmap_hsl.r = mix(240, 0, counter_norm);
			final_color.xyz = hsv2rgb(heatmap_hsl);
		}
#endif // FACE_VISUALIZATION || LAYER_VISUALIZATION
		
		hitSkybox = isSkyBox(new_vertex.color.a);

		// WARNING: I had to change this from a break statement to an if statement since it was messing with my AMD R290...
		if (!has_hit || hitSkybox)
			break;

		// connect current vertex to new vertex and get transport operator
		vec3 current_vertex_to_next_direction_ecs	= new_vertex.position - current_vertex.position;
		vec3 current_vertex_to_prev_direction_ecs	= prev_vertex_position_ecs - current_vertex.position;
		float current_vertex_to_next_dist2			= dot(current_vertex_to_next_direction_ecs, current_vertex_to_next_direction_ecs);
		current_vertex_to_next_direction_ecs		= normalize(current_vertex_to_next_direction_ecs);
		current_vertex_to_prev_direction_ecs		= normalize(current_vertex_to_prev_direction_ecs);
		
#ifdef LAMBERT_ONLY
		vec3 current_vertex_brdf					= Lambert_BRDF(current_vertex);
#else
		vec3 current_vertex_brdf					= Microfacet_Lambert_BSDF(current_vertex_to_next_direction_ecs.xyz, current_vertex_to_prev_direction_ecs.xyz, current_vertex);
#endif // LAMBERT_ONLY
		float current_vertex_geom					= getGeometricTerm(current_vertex_to_next_direction_ecs, current_vertex, new_vertex);

		vec3 current_vertex_to_next_transport_operator = current_vertex_brdf * current_vertex_geom;

		// multiply the current set of transport operators with the new
		point_transport_operators					*= current_vertex_to_next_transport_operator;
		point_transport_inverse_probabilities		*= current_vertex_to_next_inverse_probability;

		vec3 path_color = vec3(0);
			
		// connect new vertex to light (for direct lighting next event estimation) and get transport operator
		//vec3 new_vertex_light_sample_dir = normalize(light_position_ecs - new_vertex.position);
		vec3 new_vertex_light_position_ecs = light_position_ecs;
			
		vec3 new_vertex_to_light_direction_ecs	= new_vertex_light_position_ecs - new_vertex.position;
		float new_vertex_to_light_dist2			= dot(new_vertex_to_light_direction_ecs, new_vertex_to_light_direction_ecs);
		new_vertex_to_light_direction_ecs		= normalize(new_vertex_to_light_direction_ecs);
		float spoteffect = check_spotlight(new_vertex_to_light_direction_ecs);	
		float in_shadow = shadow(new_vertex.position)  * spoteffect;
		// if we didnt hit an object, we hit the light source
		if (in_shadow > 0.0)
		{
			vec3 new_vertex_to_prev_direction_ecs	= current_vertex.position - new_vertex.position;
			new_vertex_to_prev_direction_ecs		= normalize(new_vertex_to_prev_direction_ecs);
#ifdef LAMBERT_ONLY
			vec3 new_vertex_to_light_brdf			= Lambert_BRDF(new_vertex); 
#else
			vec3 new_vertex_to_light_brdf			= Microfacet_Lambert_BSDF(new_vertex_to_light_direction_ecs.xyz, new_vertex_to_prev_direction_ecs.xyz, new_vertex);
#endif // LAMBERT_ONLY
			float new_vertex_to_light_geom			= getGeometricTermPointLightSource(new_vertex_to_light_direction_ecs, new_vertex);
			vec3 new_vertex_to_light_transport_operator = new_vertex_to_light_brdf * new_vertex_to_light_geom * in_shadow;
		
#if !defined (FACE_VISUALIZATION) && !defined (LAYER_VISUALIZATION)
			path_color								= new_vertex_to_light_transport_operator * light_color_intensity / new_vertex_to_light_dist2;
			path_color								*= pi / 4.0;
			path_color								*= point_transport_operators * point_transport_inverse_probabilities;
#endif // FACE_VISUALIZATION || LAYER_VISUALIZATION
		}
#if !defined (FACE_VISUALIZATION) && !defined (LAYER_VISUALIZATION)
			// emission
			path_color.xyz	+= point_transport_operators * point_transport_inverse_probabilities * new_vertex.color.rgb * new_vertex.color.a;
#endif // FACE_VISUALIZATION || LAYER_VISUALIZATION
					
			final_color.xyz += path_color * ACCENUATE_GI;

			// reset
			// set previous vertex as the current
			// only the position is needed here (for the vector)
			prev_vertex_position_ecs = current_vertex.position;

			// set new vertex's data as the current one
			current_vertex = new_vertex;
	}	
	
#if NUM_CUBEMAPS > 1
	// this could be replaced with an actual sky model (e.g. Preetham)
	// http://amd-dev.wpengine.netdna-cdn.com/wordpress/media/2012/10/ATI-LightScattering.pdf
	if (hitSkybox)
	{		
		vec3 current_vertex_to_background_direction_ecs = new_vertex.position - current_vertex.position;
		vec3 current_vertex_to_prev_direction_ecs		= prev_vertex_position_ecs - current_vertex.position;
		float current_vertex_to_background_dist2		= dot(current_vertex_to_background_direction_ecs, current_vertex_to_background_direction_ecs);
		current_vertex_to_background_direction_ecs		= normalize(current_vertex_to_background_direction_ecs);
		current_vertex_to_prev_direction_ecs			= normalize(current_vertex_to_prev_direction_ecs);
	
#ifdef LAMBERT_ONLY		
		vec3 current_vertex_to_background_brdf			= Lambert_BRDF(current_vertex); 
#else
		vec3 current_vertex_to_background_brdf			= Microfacet_Lambert_BSDF(current_vertex_to_background_direction_ecs.xyz, current_vertex_to_prev_direction_ecs.xyz, current_vertex);
#endif // LAMBERT_ONLY
		
		current_vertex_to_background_brdf				= current_vertex.color.rgb;

		float current_vertex_to_background_geom			= NdotL(current_vertex_to_background_direction_ecs, current_vertex);
		current_vertex_to_background_geom = (dot(new_vertex.normal, -current_vertex_to_background_direction_ecs) < 0.0) ? 0.0 : current_vertex_to_background_geom;

		vec3 current_vertex_to_background_transport_operator = current_vertex_to_background_brdf * current_vertex_to_background_geom;
		final_color.xyz += point_transport_operators * point_transport_inverse_probabilities * current_vertex_to_background_transport_operator * background;
	}
#endif // NUM_CUBEMAPS

	final_color.xyz = clamp(final_color.xyz, vec3(0), vec3(2));
	store_color(final_color.xyz);
}
