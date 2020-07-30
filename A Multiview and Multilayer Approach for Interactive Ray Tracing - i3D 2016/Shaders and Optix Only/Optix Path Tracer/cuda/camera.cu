
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

#include "commonStructs.h"
#include "helpers.h"
#include "random.h"

rtBuffer<float4, 2>       output_buffer;
rtDeclareVariable(int	, max_depth, , );
rtDeclareVariable(float	, scene_epsilon, , );
rtDeclareVariable(rtObject, top_object, , );
rtDeclareVariable(Ray, ray, rtCurrentRay, );
rtDeclareVariable(uint2, launch_index, rtLaunchIndex, );

namespace camera
{
	rtDeclareVariable(float3, eye, , );
	rtDeclareVariable(float3, U, , );
	rtDeclareVariable(float3, V, , );
	rtDeclareVariable(float3, W, , );
}

namespace color
{
	rtTextureSampler<float4, 2> envmap;
	rtDeclareVariable(float3, background, , );
	rtDeclareVariable(float3, exception, , );
}

//
// Perspective Camera
//
RT_PROGRAM void pinhole_camera()
{
	unsigned int samples_per_pixel = pt::sqrt_num_samples*pt::sqrt_num_samples;

	size_t2 screen		= output_buffer.size();
	float2 inv_screen	= 1.0f / make_float2(screen) * 2.f;
	float2 pixel		= (make_float2(launch_index)) * inv_screen - 1.f;
#if defined (AA)		
	float2 jitter_scale = inv_screen / pt::sqrt_num_samples;
	unsigned int x = samples_per_pixel % pt::sqrt_num_samples;
	unsigned int y = samples_per_pixel / pt::sqrt_num_samples;
#endif

	unsigned int seed	= tea<16>(screen.x*launch_index.y + launch_index.x, pt::frame_number);
	
	float3 result = make_float3(0.0f);
	do
	{
#if defined (AA)	
		float2 jitter	= make_float2(x - rnd(seed), y - rnd(seed));
		float2 d		= pixel + jitter*jitter_scale;
#else
		float2 d		= pixel;
#endif
		float3 ray_origin	 = camera::eye;
		float3 ray_direction = normalize(d.x*camera::U + d.y*camera::V + camera::W);

		PerRayData_radiance prd;
		prd.result		 = make_float3(0.f);
		prd.attenuation  = make_float3(1.f);
		prd.done		 = false;
		prd.seed		 = seed;
		prd.depth		 = 0;

		while(!prd.done && prd.depth < max_depth)
		{
			Ray ray = make_Ray(ray_origin, ray_direction, pt::radiance_ray_type, scene_epsilon, RT_DEFAULT_MAX);
			rtTrace(top_object, ray, prd);
			
			prd.result += prd.radiance * prd.attenuation;

			// Monte Carlo strategy (Russian Roulette) as stopping criterion
			//if (prd.depth >= rr_begin_depth)
			//{
				//float pcont = fmaxf(prd.attenuation);
			//	if (rnd(prd.seed) >= pcont)
			//		break;
				//prd.attenuation /= pcont;
			//}
			
			prd.depth++;
			ray_origin	  = prd.origin;
			ray_direction = prd.direction;
		} 

		result += prd.result;
		seed	= prd.seed;
	} 
	while (--samples_per_pixel);

	float3 pixel_color = result / (pt::sqrt_num_samples*pt::sqrt_num_samples);
	if (pt::frame_number > 1)
	{
		float a = 1.0f / (float)pt::frame_number;
		float b = ((float)pt::frame_number - 1.0f) * a;
		float3 old_color = make_float3(output_buffer[launch_index]);
		output_buffer[launch_index] = make_float4(a * pixel_color + b * old_color, 0.0f);
	}
	else
		output_buffer[launch_index] = make_float4(pixel_color, 0.0f);
}
//
// Orthographic Camera
//
RT_PROGRAM void orthographic_camera()
{
	unsigned int samples_per_pixel = pt::sqrt_num_samples*pt::sqrt_num_samples;

	size_t2 screen = output_buffer.size();
	float2 inv_screen = 1.0f / make_float2(screen) * 2.f;
	float2 pixel = (make_float2(launch_index)) * inv_screen - 1.f;
#if defined (AA)	
	float2 jitter_scale = inv_screen / pt::sqrt_num_samples;
	unsigned int x = samples_per_pixel % pt::sqrt_num_samples;
	unsigned int y = samples_per_pixel / pt::sqrt_num_samples;
#endif

	unsigned int seed = tea<16>(screen.x*launch_index.y + launch_index.x, pt::frame_number);

	float3 result = make_float3(0.0f);
	do
	{
#if defined (AA)	
		float2 jitter = make_float2(x - rnd(seed), y - rnd(seed));
		float2 d = pixel + jitter*jitter_scale;
#else
		float2 d = pixel;
#endif
		float3 ray_origin = camera::eye + d.x*camera::U + d.y*camera::V;	// eye + offset in film space
		float3 ray_direction = camera::W;									// always parallel view direction

		PerRayData_radiance prd;
		prd.result = make_float3(0.f);
		prd.attenuation = make_float3(1.f);
		prd.done = false;
		prd.seed = seed;
		prd.depth = 0;

		while (!prd.done && prd.depth < max_depth)
		{
			Ray ray = make_Ray(ray_origin, ray_direction, pt::radiance_ray_type, scene_epsilon, RT_DEFAULT_MAX);
			rtTrace(top_object, ray, prd);

			prd.result += prd.radiance * prd.attenuation;

			// Monte Carlo strategy (Russian Roulette) as stopping criterion
			//if (prd.depth >= rr_begin_depth)
			//{
			//	float pcont = fmaxf(prd.attenuation);
			//	if (rnd(prd.seed) >= pcont)
			//		break;
			//	prd.attenuation /= pcont;
			//}

			prd.depth++;
			ray_origin = prd.origin;
			ray_direction = prd.direction;
		}

		result += prd.result;
		seed = prd.seed;
	} while (--samples_per_pixel);

	float3 pixel_color = result / (pt::sqrt_num_samples*pt::sqrt_num_samples);
	if (pt::frame_number > 1)
	{
		float a = 1.0f / (float)pt::frame_number;
		float b = ((float)pt::frame_number - 1.0f) * a;
		float3 old_color = make_float3(output_buffer[launch_index]);
		output_buffer[launch_index] = make_float4(a * pixel_color + b * old_color, 0.0f);
	}
	else
		output_buffer[launch_index] = make_float4(pixel_color, 0.0f);
}
//
// Returns environment map color for miss rays
//
RT_PROGRAM void envmap_miss()
{
	float theta = atan2f(ray.direction.x, ray.direction.z);
	float phi = M_PIf * 0.5f - acosf(ray.direction.y);
	float u = (theta + M_PIf) * (0.5f * M_1_PIf);
	float v = 0.5f * (1.0f + sin(phi));

	pt::prd_radiance.radiance = make_float3(tex2D(color::envmap, u, v));
	pt::prd_radiance.done = true;
}
//
// Returns background color for miss rays
//
RT_PROGRAM void background_miss()
{
	pt::prd_radiance.radiance = color::background;
	pt::prd_radiance.done = true;
}
//
// Returns solid color upon failure
//
RT_PROGRAM void exception()
{
	rtPrintf("Caught exception 0x%X at launch index (%d,%d)\n", rtGetExceptionCode(), launch_index.x, launch_index.y);
	output_buffer[launch_index] = make_float4(color::exception, 0.0f);
}
