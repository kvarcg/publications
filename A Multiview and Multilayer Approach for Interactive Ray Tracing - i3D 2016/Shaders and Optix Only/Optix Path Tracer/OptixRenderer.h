
/*
* Copyright (c) 2008 - 2009 NVIDIA Corporation.  All rights reserved.
*
* NVIDIA Corporation and its licensors retain all intellectual property and proprietary
* rights in and to this software, related documentation and any modifications thereto.
* Any use, reproduction, disclosure or distribution of this software and related
* documentation without an express license agreement from NVIDIA Corporation is strictly
* prohibited.
*
* TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THIS SOFTWARE IS PROVIDED *AS IS*
* AND NVIDIA AND ITS SUPPLIERS DISCLAIM ALL WARRANTIES, EITHER EXPRESS OR IMPLIED,
* INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
* PARTICULAR PURPOSE.  IN NO EVENT SHALL NVIDIA OR ITS SUPPLIERS BE LIABLE FOR ANY
* SPECIAL, INCIDENTAL, INDIRECT, OR CONSEQUENTIAL DAMAGES WHATSOEVER (INCLUDING, WITHOUT
* LIMITATION, DAMAGES FOR LOSS OF BUSINESS PROFITS, BUSINESS INTERRUPTION, LOSS OF
* BUSINESS INFORMATION, OR ANY OTHER PECUNIARY LOSS) ARISING OUT OF THE USE OF OR
* INABILITY TO USE THIS SOFTWARE, EVEN IF NVIDIA HAS BEEN ADVISED OF THE POSSIBILITY OF
* SUCH DAMAGES
*/

#if defined(__APPLE__)
#  include <OpenGL/gl.h>
#else
#  include <GL/glew.h>
#  if defined(_WIN32)
#    include <GL/wglew.h>
#  endif
#  include <GL/gl.h>
#endif

#include <optixu/optixpp_namespace.h>
#include <optixu/optixu_math_namespace.h>
#include <iostream>
#include <GLUTDisplay.h>
#include <ImageLoader.h>
#include <OptiXMesh.h>
#include <cstdlib>
#include <cstring>
#include <sstream>
#include <math.h>
#include "commonStructs.h"

using namespace std;
using namespace optix;

class OptixRenderer : public SampleScene
{
public:

	static enum ShadingModel
	{
		SM_NORMAL = 0,
		SM_LAMBERTIAN,
		SM_PHONG_DIRECT
	};
	static enum ShadowingModel
	{
		SM_SIMPLE = 0,
		SM_TRANSPARENT
	};
	static enum CameraType
	{
		CT_PINHOLE = 0,
		CT_ORTHO
	};
	static enum SamplingStrategy
	{
		SS_BSDF = 0,
	};
	static enum SpatialDataStructureType
	{
		SDS_TRBVH = 0,
		SDS_SBVH,
		SDS_MBVH,
		SDS_LBVH,
		SDS_CBVH,
		SDS_BVH,
		SDS_TKDT,
		SDS_KDT,
		SDS_NO_ACCEL
	};

	static const string getSpatialDataStructure(SpatialDataStructureType value)
	{
		return SpatialDataStructures[value];
	}
	static const string getShadingModel(ShadingModel value)
	{
		return ShadingModels[value];
	}
	static const string getShadowingModel(ShadowingModel value)
	{
		return ShadowingModels[value];
	}
	static const string getCameraType(CameraType value)
	{
		return CameraTypes[value];
	}

	OptixRenderer(const string& tex_path, const unsigned int w, const unsigned int h) : SampleScene(),
		m_camera_type(CT_PINHOLE),
		m_shading_model(SM_PHONG_DIRECT),
		m_shadowing_model(SM_SIMPLE),
		m_envmap_enabled(false),
		m_shadows_enabled(true),
		m_sds_builder(SDS_TRBVH),
		m_sds_traverser(SDS_BVH),
		m_width(720),
		m_height(480),
		m_fov(40.0f),
		m_gamma(2.2f),
		m_frame(0u),
		m_rr_begin_depth(0u),
		m_sqrt_num_samples(1), 
		m_sampling_strategy(SS_BSDF),
		m_bounces(2),
		m_model_name("sponza.obj"),
		m_texture_path(tex_path){}

	// From SampleScene
	void	initScene(InitialCameraData&	camera_data);
	void	trace(const RayGenCameraData&	camera_data);
	Buffer  getOutputBuffer(void) { return m_context["output_buffer"]->getBuffer(); }

	string	texpath(const string& base) { return m_texture_path + "/" + base; }

private:
	
	bool			m_envmap_enabled;
	bool			m_shadows_enabled;

	SpatialDataStructureType	m_sds_builder, m_sds_traverser;

	unsigned int		m_sqrt_num_samples;
	SamplingStrategy	m_sampling_strategy;

	float			m_fov;
	float 			m_gamma;
	
	float3			m_ambient_light_color;

	int				m_bounces;

	unsigned int	m_frame;
	unsigned int	m_width;
	unsigned int	m_height;

	string			m_model_name;
	string			m_texture_path;
	Aabb			m_model_aabb;

	Geometry		m_model_geometry;
	GeometryGroup	m_geometry_group;

	Program			m_model_any_hit_program;
	Program			m_model_closest_hit_program;

	Buffer			m_light_buffer;

	CameraType		m_camera_type;
	ShadingModel	m_shading_model;
	ShadowingModel	m_shadowing_model;

	static float3	m_default_color;
	static float3	m_exception_color;
	static float3	m_background_color;
	
	static string	SpatialDataStructures[];
	static string	ShadingModels[];
	static string	ShadowingModels[];
	static string	CameraTypes[];

	void initContext(void);
	void initRayPrograms(void);
	void initCamera(InitialCameraData& camera_data);
	void initLighting(void);
	void initGeometry(void);
	void initModel(void);
	void finalize(void);
};