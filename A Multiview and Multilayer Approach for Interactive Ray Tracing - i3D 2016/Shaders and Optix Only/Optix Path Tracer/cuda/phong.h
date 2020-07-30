
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

#include <optix_world.h>
#include "commonStructs.h"
#include "helpers.h"
#include "random.h"

rtDeclareVariable(int	, max_depth, , );
rtDeclareVariable(float	, scene_epsilon, , );

rtDeclareVariable(optix::Ray, ray, rtCurrentRay, );
rtDeclareVariable(float, t_hit, rtIntersectionDistance, );

rtBuffer<BasicLight>      lights;
rtDeclareVariable(float3, ambient_light_color, , );
rtDeclareVariable(float3, shadow_attenuation, , );

rtDeclareVariable(rtObject, top_object, , );
rtDeclareVariable(rtObject, top_shadower, , );

//
// Terminates and fully attenuates ray after any hit
//
static
__device__ void path_tracingShadowed()
{
	pt::prd_shadow.inShadow = true;
	rtTerminateRay();
}

static
__device__ void path_tracingShade(float3 p_normal,
float3 p_Ka,
float3 p_Kd,
float3 p_Ks,
float3 p_reflectivity,
float  p_phong_exp)
{
	// [3D Hit Point]
	float3 hit_point = ray.origin + t_hit * ray.direction;

	// [Shading for each ray]
	float3 result = p_Ka * ambient_light_color;
	for (int i = 0; i < lights.size(); ++i)
	{
		BasicLight	light = lights[i];

		float  Latt;
		float  Ldist;
		float3 L, Lpos = make_float3(light.pos.x, light.pos.y, light.pos.z);

		if (light.pos.w == 0.0f) // A. Directional light
		{
			L	 = normalize(Lpos); Latt = 1.0f; 
		}
		else 					 // B. Point light
		{
			L	  = normalize(Lpos - hit_point);
			Ldist = length(Lpos - hit_point);
			Latt  = 1.0f / (Ldist*Ldist);

			//cone restrictions (affects attenuation)
			float lightToSurfaceAngle = degrees(acos(dot(-L, normalize(light.coneTarget-Lpos))));
			if (lightToSurfaceAngle > light.coneAngle)
				Latt = 0.0f;
		}

		float diffuseCoefficient = dot(p_normal, L);
		if (Latt > 0.0f && diffuseCoefficient > 0.0f)
		{
			// [Cast Shadow Ray]
			PerRayData_shadow shadow_prd;
			if (light.casts_shadow)
			{
				shadow_prd.inShadow = false;
				Ray shadow_ray(hit_point, L, pt::shadow_ray_type, scene_epsilon, Ldist);
				rtTrace(top_shadower, shadow_ray, shadow_prd);
			}

			// If not completely shadowed, light the hit point
			if (!shadow_prd.inShadow)
			{
				// [Light Color]
				float3 Lc = Latt * light.flux * light.color;
				
				// [Diffuse Color]
				float3 diffuse = (p_Kd / M_PIf) * diffuseCoefficient;

				// [Specular Color]
				//float3 specular = make_float3(0.0f);
				//float3 H = normalize(L - ray.direction);
				//float nDh = dot(p_normal, H);
				//float specularCoefficient = pow(max(0.0f,nDh), p_phong_exp);
				//specular = ((p_phong_exp + 8.0f)* p_Ks / 8.0f* M_PIf) * specularCoefficient;

				// [Final Color]
				result += diffuse * Lc;
			}
		}
	}

	// [New direction]
	{
		float3 p;
		float z1 = rnd(pt::prd_radiance.seed);
		float z2 = rnd(pt::prd_radiance.seed);
		cosine_sample_hemisphere(z1, z2, p);

		float3 v1, v2;
		createONB(p_normal, v1, v2);

		pt::prd_radiance.origin = hit_point;
		pt::prd_radiance.direction = v1 * p.x + v2 * p.y + p_normal * p.z;
		pt::prd_radiance.attenuation *= p_Kd; // use the diffuse_color as the diffuse response
	}

	// pass the color back up the tree
	pt::prd_radiance.radiance = result;
}