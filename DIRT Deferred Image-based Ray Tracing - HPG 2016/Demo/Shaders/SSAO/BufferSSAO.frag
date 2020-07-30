// The Screen-Space Ambient Occlusion Algorithm (ACM SIGGRAPH 2007 courses)
// https://dl.acm.org/citation.cfm?doid=1281500.1281671
// Implementation Authors: K. Vardis, G. Papaioannou

#version 330 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_depth;
uniform sampler2D sampler_normal;
uniform sampler3D sampler_noise;
uniform mat4 uniform_proj;
uniform mat4 uniform_view;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform int uniform_num_samples;
uniform float uniform_range;
#define NUM_SAMPLES __NUM_SAMPLES__

#include "random_number.h"
#include "matrix_transformations.h"
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
	
	vec3 normal_unclamped_wcs = vec4(uniform_view_inverse * vec4(normal_decode_spheremap1(texture(sampler_normal, TexCoord.xy).xy), 0.0)).rgb;
	normal_unclamped_wcs = normalize(normal_unclamped_wcs);

	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, texture(sampler_depth, TexCoord.xy).r);
	vec3 pwcs = PointECS2WCS(pecs);

	// Sample a noise pattern to get a random rotation and sample offset
	vec3 seed = (pwcs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0));
	vec3 random_rotation = rand3n(13 * seed.xy + 17 * seed.xz).xyz;
	random_rotation.x *= 2.0 * 3.1415936;
	float range_scale = 0.5 * (random_rotation.y + random_rotation.z) * uniform_range;
	
	pwcs += 0.05 * normal_unclamped_wcs;
	
	float total_occlusion = 0.0;
	vec3 bent_normal = normalize(normal_unclamped_wcs) * 0.1;
	float divsamples = 1 / float(uniform_num_samples);
	
	mat4 view_vp = uniform_proj * uniform_view;

	for (int sample_index = 0; sample_index < uniform_num_samples; sample_index++)
	{
		vec3 cur_sample = pwcs + range_scale * getNewSamplePositionUniformHemisphereSampling(sample_index, normal_unclamped_wcs);
	
		// get the new vector from world space to clip space
		vec4 pndc_sample = view_vp * vec4(cur_sample.xyz, 1.0);
		pndc_sample /= pndc_sample.w;
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;

		// grab the sample depth and transform it to view space
		float sample_depth = texture(sampler_depth, pndc_sample.xy).r;
				
		// check if sample is occluded (or if sampled depth has higher value in the depth buffer)
		// transform sample clip xyz coordinates to world space
		vec4 pecs_sample = uniform_proj_inverse * vec4(2 * pndc_sample.xyz - 1, 1.0);
		pecs_sample = pecs_sample/pecs_sample.w;
		// transform sample clip xy coordinates to world space with depth buffer value
		vec4 pecs_z_sample = uniform_proj_inverse * vec4(2 * vec3(pndc_sample.xy, sample_depth) - 1, 1.0);
		pecs_z_sample = pecs_z_sample/pecs_z_sample.w;
		
		vec4 pecs = uniform_view * vec4(pwcs.xyz, 1);
		bool is_visible = pecs_sample.z > pecs_z_sample.z;
		bool outside_radius = ((pecs_z_sample.x - pecs.x) * (pecs_z_sample.x - pecs.x) + 
							  (pecs_z_sample.y - pecs.y) * (pecs_z_sample.y - pecs.y) + 
							  (pecs_z_sample.z - pecs.z) * (pecs_z_sample.z - pecs.z)) >= (uniform_range * uniform_range);

		total_occlusion += (is_visible || outside_radius)? 1.0: 0.0;
		bent_normal += (is_visible || outside_radius)? normalize(pecs_sample.xyz - pecs.xyz): vec3(0.0, 0.0, 0.0);
	}

	total_occlusion *= divsamples;

	bent_normal = normalize(bent_normal);	
	bent_normal.xyz = vec3(0.5 + bent_normal.xy * 0.5, bent_normal.z);

	out_color = vec4(bent_normal, total_occlusion);
	out_color = vec4(total_occlusion, total_occlusion, total_occlusion, total_occlusion);
}
