// Image-Space Horizon-Based Ambient Occlusion (ACM SIGGRAPH 2008 Talk)
// https://dl.acm.org/citation.cfm?id=1401061
// Implementation Authors: K. Vardis, G. Papaioannou

#version 330 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_depth;
uniform sampler2D sampler_normal;
uniform sampler3D sampler_noise;
uniform mat4 uniform_proj;
uniform mat4 uniform_proj_inverse;
uniform int uniform_num_samples;
uniform int uniform_num_slices;
uniform float uniform_range;

#include "random_number.h"
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
		
	float occlude_factor = 0.0;
	
	// calculate tangent, bitangent
	// if normal is (0,1,0) use (1,0,0)
	vec3 tangent_ecs = cross(normal_unclamped_ecs, vec3(0.0, 1.0, 0.0));
	if (dot(tangent_ecs, tangent_ecs) < 1.e-3f)
		tangent_ecs = cross(normal_unclamped_ecs, vec3(1.0, 0.0, 0.0));
	tangent_ecs = normalize(tangent_ecs);
	vec3 bitangent_ecs = cross(normal_unclamped_ecs, tangent_ecs);
	
	// Sample a noise pattern to get a random rotation and sample offset
	vec3 seed = (pecs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0));
	vec3 random_rotation = rand3n(13 * seed.xy + 17 * seed.xz).xyz;
	random_rotation.x *= 2.0 * 3.1415936;
	
	pecs += 0.05 * normal_unclamped_ecs;

	float sliceStep = (2.0 * 3.1415936) / float(uniform_num_slices);
	float sample_step = uniform_range / float(uniform_num_samples);

	float current_angle = 0;
	float total_occlusion = 0;
	
	vec3 total_bent_normal = normal_unclamped_ecs * uniform_num_slices * uniform_num_samples * 0.5; 
	
	for (int slice_index = 0; slice_index < uniform_num_slices; slice_index++)
	{
		// create ray based on current angle
		// working on tangent space to simplify calculations and then convert back to eye space
		vec3 horizon_dir = tangent_ecs * cos(current_angle + random_rotation.x) + bitangent_ecs * sin(current_angle + random_rotation.x);

		float elevation_angle = 0;
		float elevation_distance = 0;
		for (int sample_index = 1; sample_index <= uniform_num_samples; ++sample_index)
		{
			// create sample in eye space based on ray direction and radius
			vec3 cur_sample = pecs.xyz + horizon_dir * ((sample_index-random_rotation.y) * sample_step);

			// project sample onto screen space
			vec4 pndc_sample = uniform_proj * vec4(cur_sample.xyz, 1.0);
			pndc_sample /= pndc_sample.w;
			pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
			pndc_sample.xyz = clamp(pndc_sample.xyz, 0.0, 1.0);

			// sample the depth buffer
			float sample_depth = texture(sampler_depth, pndc_sample.xy).r;

			// unproject the point to get it to eye space
			vec4 pecs_sample_z = uniform_proj_inverse * vec4(2 * pndc_sample.xy - 1, 2 * sample_depth - 1, 1.0);
			pecs_sample_z /= pecs_sample_z.w;

			// create a vector from pixel point P to sampled point
			vec3 sampled_point_dir = normalize(pecs_sample_z.xyz - pecs.xyz);
			
			// find the angle between the pixel to sampled point vector and the original direction vector
			float sample_elevation_angle = max(0.0, dot(sampled_point_dir, normal_unclamped_ecs));

			float distance_point_to_sample = distance(pecs.xyz, pecs_sample_z.xyz);
			bool larger_than_radius = distance_point_to_sample > uniform_range;
			if (elevation_angle < sample_elevation_angle && !larger_than_radius)
			{
				elevation_angle = sample_elevation_angle;
				horizon_dir = sampled_point_dir;
				elevation_distance = distance_point_to_sample;
			}
			total_bent_normal += (pndc_sample.z < sample_depth)? normalize(cur_sample - pecs):vec3(0,0,0);
		}
		
		// evaluate the inner integral which is sin(elevation_angle) - sin(ray_dir_angle)
		// since the ray_dir_angle is 0, so sin(0) = 0, the second part is omitted
		//float attenuation =  1 - ((elevation_distance/uniform_range));
		//attenuation = clamp(attenuation, 0.01, 1.0);
		total_occlusion += elevation_angle * 1;

		// bent normal should be vertical to the horizon dir
		//vec3 ver_to_normal_hor = cross(horizon_dir, normal_unclamped_ecs);
		//vec3 horizon_bent_normal = cross(ver_to_normal_hor, horizon_dir);
		//total_bent_normal += horizon_bent_normal + normal_unclamped_ecs;// attenuation * horizon_dir + (1 - attenuation) * normal_unclamped_ecs;

		// increase angle
		current_angle += sliceStep;
	}

	// evaluate the outer integral using constant approximation
	total_occlusion /= float(uniform_num_slices);
	total_occlusion = 1.0 - total_occlusion;

	total_bent_normal = normalize(total_bent_normal);	
	total_bent_normal.xyz = vec3(0.5+total_bent_normal.x/2.0, 0.5+total_bent_normal.y/2.0,total_bent_normal.z);

	out_color = vec4(total_bent_normal.xyz,total_occlusion);
	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
}
