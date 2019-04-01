// Variable k-Buffer using Importance Maps (Short Eurographics 2017)
// https://diglib.eg.org/handle/10.2312/egsh20171005
// Authors: A.A. Vasilakis, K. Vardis, G. Papaioannou, K. Moustakas
// Fragment shader for AO

// An implementation of the Alchemy Ambient Occlusion method by Morgan McGuire 
// (The Alchemy Screen-Space Ambient Obscurance Algorithm, HPG 2011)
// Author: G. Papaioannou
//
// Notes:
// - All computations are made in the eye coordinate system for view invariance
// - A carefully chosen hemisphere sampling pattern is provided to minimize artifacts
// - Uses a total of 17 texture reads (15 taps, 1 early reject depth lookup, 1 noise texture lookup)
#version 330 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform mat4 uniform_proj;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform int uniform_num_samples;
uniform float uniform_range;
#define NUM_SAMPLES __NUM_SAMPLES__
uniform vec3 uniform_samples[NUM_SAMPLES];

#include "random_number.h"
#include "normal_compression.h"
#include "depth_reconstruction.h"

#define KBUFFER_SIZE			__ABUFFER_LOCAL_SIZE__
#define KBUFFER_SIZE_1n			KBUFFER_SIZE - 1
#define __KBUFFER_METHOD__
// KB_AB_SB
#if defined(KB_AB_SB)
layout(binding = 0, r32ui  ) readonly  uniform uimage2D		image_counter;
layout(binding = 1, r32ui  ) readonly  uniform uimage2D		image_head;
layout(binding = 2, std430 ) coherent buffer   SBUFFER	{ NodeTypeDataSB nodes []; };
layout(binding = 3, rgba32f) writeonly uniform image2D		image_prev;

uint getPixelHeadAddress	() {return imageLoad (image_head   , ivec2(gl_FragCoord.xy)).x;}
uint getPixelFragCounter	() {return imageLoad (image_counter, ivec2(gl_FragCoord.xy)).x;}

uint  fragments_id[KBUFFER_SIZE];
float fragments_depth[KBUFFER_SIZE];
void sort(const int num)
{
	for (int j = 1; j < num; ++j)
	{
		float key_depth = fragments_depth[j];
		uint  key_id	= fragments_id[j];
		int i = j - 1;
		while (i >= 0 && fragments_depth[i] > key_depth)
		{
			fragments_depth[i+1] = fragments_depth[i];
			fragments_id[i+1]	 = fragments_id[i];
			--i;
		}
		fragments_id[i+1] = key_id;
		fragments_depth[i+1] = key_depth;
	}
}
// KB_MDT_32
#elif defined(KB_MDT_32)
layout(binding = 0, rgba32ui) readonly uniform  uimage2DArray image_peel_data;
layout(binding = 1, r32ui   ) readonly uniform  uimage2DArray image_peel_depth;
layout(binding = 2, r32ui) readonly uniform uimage2D image_k_map;
layout(binding = 3, rgba32f) writeonly uniform image2D		image_prev;

uint getPixelFragDepthValue(const int coord_z) {return imageLoad (image_peel_depth, ivec3(gl_FragCoord.xy, coord_z)).r;}
uvec4 getPixelFragDataValue(const int coord_z) {return imageLoad (image_peel_data, ivec3(gl_FragCoord.xy, coord_z));}
uint getMaxPixelKValue	   (				 ) { return imageLoad  (image_k_map, ivec2(gl_FragCoord.xy)).r;}

vec2 fragments[KBUFFER_SIZE];
#endif
layout(binding = 4, rgba) coherent uniform image2D		image_occlusion;

float getOcclusion()
{	
	float occlude_factor = 0.0;
	// calculate tangent, bitangent
	vec3 tangent_ecs = vec3(1.0, 0.0, 0.0);
	vec3 bitangent_ecs = vec3(0.0, 1.0, 0.0);

	// if normal is (0,1,0) use (1,0,0)
	if (abs(normal_unclamped_ecs.z) < 0.001 && abs(normal_unclamped_ecs.x) < 0.001)
	{
		bitangent_ecs = normalize(cross(normal_unclamped_ecs, tangent_ecs));
		tangent_ecs = normalize(cross(normal_unclamped_ecs, bitangent_ecs));
	}
	else
	{
		tangent_ecs = normalize(cross(normal_unclamped_ecs, bitangent_ecs));
		bitangent_ecs = normalize(cross(normal_unclamped_ecs, tangent_ecs));
	}
	
	// Sample a noise pattern to get a random rotation and sample offset
	vec3 random_rotation = rand3_sin(17 * TexCoord.xy)
	random_rotation.x *= 2.0 * 3.1415936;

	// Create a rotate version of the tangential coordinate system:  
	// (right_ecs,front_ecs) -> (vec_u,vec_v). The normal remains unchanged
	vec3 vec_u = tangent_ecs * cos(random_rotation.x) + bitangent_ecs * sin(random_rotation.x); 
	vec3 vec_v = cross(vec_u, normal_unclamped_ecs); 

	// Initialize obscurance and bent normal
	float total_occlusion = 0.0; 
	float angle = 1;
	float rotation_scale = 0.5*(random_rotation.y + random_rotation.z) * uniform_range;
	pecs += 0.05 * normal_unclamped_ecs;

	for (int sample_index = 0; sample_index < uniform_num_samples; sample_index++) 
	{ 
		//Create ecs hemisphere sample
		vec3 cur_sample = pecs + rotation_scale * (vec_u*uniform_samples[sample_index].x + vec_v*uniform_samples[sample_index].y + normal_unclamped_ecs * uniform_samples[sample_index].z);
		
		// project ecs sample to clip space
		vec4 pndc_sample = uniform_proj * vec4(cur_sample.xyz, 1.0);
		pndc_sample /= pndc_sample.w;
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
		
		// sample the depth buffer
		float sample_depth = texture(sampler_depth, pndc_sample.xy).r;

		// move sample on surface 
		// unproject the point to get it to eye space
		vec4 pecs_sample_z = uniform_proj_inverse * vec4(2 * vec3(pndc_sample.xy, sample_depth) - 1, 1.0);
		pecs_sample_z /= pecs_sample_z.w;
		
		// measure the sample distance to the lit point (hemisphere center)
		float dist = distance(pecs_sample_z.xyz, pecs); 
		
		// Estimate occlusion 
		// create a vector from pixel point P to sampled point
		vec3 sampled_point_dir = normalize(pecs_sample_z.xyz - pecs.xyz);

		angle = max(0.0, dot(sampled_point_dir, normal_unclamped_ecs));
		
		float sample_occlusion = (dist < uniform_range)? angle:0.0;
		vec3 bent_normal = (pndc_sample.z < sample_depth)? normalize(cur_sample - pecs):vec3(0,0,0);
		total_occlusion += sample_occlusion;
	} 
}

void main(void)
{
	float divsamples = 1 / float(uniform_num_samples);

	// this can be optimized. simple implementation
	int  counter=0; 
	uint Zi=0u;
	int per_pixel_k = int(getMaxPixelKValue());
	// I am not removing counter < KBUFFER_SIZE for optimization purposes
	while(counter < KBUFFER_SIZE && counter < per_pixel_k && (Zi = getPixelFragDepthValue(counter)) < 0xFFFFFFFFU)
	{
		counter++; 
	}
	
	float total_occlusion = imageLoad(image_occlusion, ivec2(gl_FragCoord.xy));
	vec3 ambient_light = uniform_ambient_light_color.rgb;

	if (counter > 1)
	{
		int i = 0;
		// unpack
		uvec4 packed_data = getPixelFragDataValue(i);
		vec4 albedo_opacity = unpackUnorm4x8(packed_data.r);
		vec2 normal_packed = unpackUnorm2x16(packed_data.g);
		vec4 spec_coef = unpackUnorm4x8(packed_data.b);
		float depth = uintBitsToFloat(getPixelFragDepthValue(i));
		float fragment_alpha = albedo_opacity.a;

		float current_depth = texture(sampler_depth, TexCoord.xy).r;
		if (current_depth == 1.0) 
		{
			out_color = vec4(1,1,1,1); return;
		}
		
		vec3 normal_unclamped_ecs = normal_decode_spheremap1(normal_packed.rg);
		vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, depth);
		//float getOcclussion
	}	

	total_occlusion *= divsamples;
	total_occlusion = 1 - total_occlusion;

	//total_occlusion *= total_occlusion;

	// Adjust output range and store results.
	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
}
