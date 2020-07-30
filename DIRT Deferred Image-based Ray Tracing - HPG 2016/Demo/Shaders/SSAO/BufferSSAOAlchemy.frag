// The Alchemy Screen-Space Ambient Obscurance Algorithm (HPG 2011)
// https://dl.acm.org/citation.cfm?id=2018323.2018327
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
uniform float uniform_range;
#define NUM_SAMPLES __NUM_SAMPLES__

#include "random_number.h"
#include "normal_compression.h"
#include "depth_reconstruction.h"

vec3 getUniformHemisphereSample(float iteration) {
	vec2 seed = getSamplingSeedIteration(TexCoord, iteration/float(NUM_SAMPLES));
	vec2 u = rand2n(seed);
	
	float z = u.x;
	float r = sqrt(max(0.0, 1.0 - z * z));
	float phi = 2.0 * pi * u.y;
	float x = r * cos(phi);
	float y = r * sin(phi);
	return vec3(x,y,z);
} 

vec3 getNewSamplePositionUniformHemisphereSampling(float iteration, vec3 normal)
{
	// calculate tangent, bitangent
	vec3 tangent = cross(normal, vec3(0.0, 1.0, 0.0));
	if (dot(tangent, tangent) < 1.e-3f)
		tangent = cross(normal, vec3(1.0, 0.0, 0.0));
	tangent = normalize(tangent);
	vec3 bitangent = cross(normal, tangent);
	
	vec3 cur_sample = getUniformHemisphereSample(iteration);
	vec3 current_vertex_sample_dir = normalize(tangent*cur_sample.x + bitangent*cur_sample.y + normal * cur_sample.z);
	
	return current_vertex_sample_dir;
}

void main(void)
{
	float current_depth = texture(sampler_depth, TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(1,1,1,1); return;
	}
		
	vec3 normal_unclamped_ecs = normal_decode_spheremap1(texture(sampler_normal, TexCoord.xy).xy);

	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, texture(sampler_depth, TexCoord.xy).r);
	
	float occlude_factor = 0.0;
	
	// Sample a noise pattern to get a random rotation and sample offset
	//vec3 random_rotation = texture(sampler_noise, 10 * (pecs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0))).xyz;
	vec3 seed = (pecs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0));
	vec3 random_rotation = rand3n(13 * seed.xy + 17 * seed.xz).xyz;
	//vec3 random_rotation = texture(sampler_noise, 17 * seed).xyz;
	random_rotation.x *= 2.0 * 3.1415936;
	
	float range_scale = 0.5 * (random_rotation.y + random_rotation.z) * uniform_range;

	// Initialize obscurance and bent normal
	float total_occlusion = 0.0; 
	vec3 total_bent_normal = 0.1 * normal_unclamped_ecs; 
	float angle = 1;
	pecs += 0.05 * normal_unclamped_ecs;

	float divsamples = 1.0 / float(NUM_SAMPLES);
	
	for (int sample_index = 0; sample_index < NUM_SAMPLES; sample_index++) 
	{ 
		//Create ecs hemisphere sample		
		vec3 cur_sample = pecs + range_scale * getNewSamplePositionUniformHemisphereSampling(sample_index, normal_unclamped_ecs);
		
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
		//total_bent_normal += (sample_occlusion > 0.0)? bent_normal:vec3(0,0,0);
		//if (dist < uniform_range)
		//total_bent_normal += bent_normal;
		//total_bent_normal += reflect(bent_normal,normal_unclamped_ecs)  * out_of_range;
		
		// Compute attenuation function (if any). 
		//float u_ = 0.05 * uniform_range; 
		//total_occlusion += u_ * 3.14 * sample_occlusion * divsamples / (max(u_*u_,dist));
		total_occlusion += sample_occlusion;
	} 

	total_occlusion *= divsamples;
	total_occlusion = 1 - total_occlusion;

	total_bent_normal = normalize(total_bent_normal); 
	
	out_color = vec4(total_bent_normal.xyz, total_occlusion);
	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
}
