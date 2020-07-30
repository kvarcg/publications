// Volumetric Obscurance by Bradford James Loos (I3D 2010)
// https://dl.acm.org/citation.cfm?id=1730829
// Implementation Authors: K. Vardis, G. Papaioannou

#version 330 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_depth;
uniform sampler2D sampler_normal;
uniform sampler3D sampler_noise;
uniform mat4 uniform_proj;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_view;
uniform int uniform_num_samples;
uniform float uniform_range;
uniform int uniform_num_views;
#define NUM_SAMPLES __NUM_SAMPLES__
uniform vec3 uniform_samples[NUM_SAMPLES];

#include "random_number.h"
#include "matrix_transformations.h"
#include "normal_compression.h"
#include "depth_reconstruction.h"

void main(void)
{
	float current_depth = texture(sampler_depth, TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(1,1,1,1); return;
	}

	vec3 normal_unclamped_ecs = normal_decode_spheremap1(texture(sampler_normal, TexCoord.xy).xy);
	normal_unclamped_ecs = normalize(normal_unclamped_ecs);

	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, texture(sampler_depth, TexCoord.xy).r);
	
	// Sample a noise pattern to get a random rotation and sample offset
	vec3 seed = (pecs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0));
	vec3 random_rotation = rand3n(13 * seed.xy + 17 * seed.xz).xyz;
	random_rotation.x *= 2.0 * 3.1415936;

	float cosr = cos(random_rotation.x);
	float sinr = sin(random_rotation.x);

	mat2 rot = mat2(cosr, -sinr, sinr, cosr);

	// Initialize obscurance and bent normal
	float total_occlusion = 0.0; 
	pecs += 0.05 * normal_unclamped_ecs;

	float divsamples = 1.0 / float(uniform_num_samples);

	float max_volume = 0;
	float avg_distance = 0;
	for (int sample_index = 0; sample_index < uniform_num_samples; sample_index++) 
	{ 
		//Create ecs disk sample
		vec3 cur_sample = pecs.xyz + vec3(rot * uniform_samples[sample_index].xy * uniform_range, 0);
				
		// project ecs sample to clip space
		vec4 pndc_sample = uniform_proj * vec4(cur_sample.xyz, 1.0);
		pndc_sample /= pndc_sample.w;		
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
		
		// sample the depth buffer
		float sample_depth = texture(sampler_depth, pndc_sample.xy).r;

		// unproject sampled depth to ecs
		vec4 pecs_sample_z = uniform_proj_inverse * vec4(2*pndc_sample.xy-1, 2*sample_depth-1, 1.0);
		pecs_sample_z /= pecs_sample_z.w;

		float zs = uniform_samples[sample_index].z * uniform_range;

		// find length of ray to depth
		float dist_pecs_z = pecs_sample_z.z - cur_sample.z;

		// find length of ray from sample to either depth or to the projection to front unit hemisphere
		float length_line = max(min(dist_pecs_z, zs) + zs, 0);
		
		// multiply length of line by the area patch for each sample
		float current_occlusion = length_line;
		float rad = uniform_range / uniform_num_samples;
		current_occlusion = length_line / (2 * zs);
		total_occlusion += current_occlusion;
	} 

	total_occlusion *= divsamples;
	total_occlusion = 1 - total_occlusion;

	total_occlusion += 0.5;
	//total_occlusion *= total_occlusion;

	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
}
