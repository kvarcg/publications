
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

#include <optix.h>
#include <optixu/optixu_math_namespace.h>
#include "phong.h"

using namespace optix;

// Correspond to OBJ mtl params
namespace obj_material
{
	rtTextureSampler<float4, 2>   ambient_map;
	rtTextureSampler<float4, 2>   diffuse_map;		
	rtTextureSampler<float4, 2>   specular_map;		 
	
	rtDeclareVariable(int	, illum		, , );
	rtDeclareVariable(float	, phong_exp	, , );		
}

// Correspond to OBJ geom params
namespace obj_geometry
{
	rtDeclareVariable(float3, texcoord			, attribute texcoord, );
	rtDeclareVariable(float3, geometric_normal	, attribute geometric_normal, );
	rtDeclareVariable(float3, shading_normal	, attribute shading_normal, );
}

RT_PROGRAM void any_hit_shadow()
{
	path_tracingShadowed();
}

RT_PROGRAM void closest_hit_radiance()
{
	float3 direction				= ray.direction;
	float3 world_shading_normal		= normalize(rtTransformNormal(RT_OBJECT_TO_WORLD, obj_geometry::shading_normal));
	float3 world_geometric_normal	= normalize(rtTransformNormal(RT_OBJECT_TO_WORLD, obj_geometry::geometric_normal));
	float3 ffnormal					= faceforward(world_shading_normal, -direction, world_geometric_normal);
	float3 uv						= obj_geometry::texcoord;
	float3 black					= make_float3(0.0f, 0.0f, 0.0f);

	// grab values from textures
	// support only MTL illumination modes 0-3 (Ks is for now used as reflectivity)
	float3 Kd = make_float3(tex2D(obj_material::diffuse_map, uv.x, uv.y));
	float3 Ka = (obj_material::illum < 1) ? black : make_float3(tex2D(obj_material::ambient_map, uv.x, uv.y));
	float3 Ks = (obj_material::illum < 2) ? black : make_float3(tex2D(obj_material::specular_map, uv.x, uv.y));
	float3 Kr = (obj_material::illum < 3) ? black : Ks;

	path_tracingShade(ffnormal, Ka, Kd, Ks, Kr, obj_material::phong_exp);
}