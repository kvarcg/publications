// Multi-view Ambient Occlusion with Importance Sampling (I3D 2013)
// http://dl.acm.org/citation.cfm?id=2448214
// Authors: K. Vardis, G. Papaioannou, A. Gaitatzes
//
// Implementation of Multi-view VO, based on 
// Volumetric Obscurance by Bradford James Loos (I3D 2010)
// https://dl.acm.org/citation.cfm?id=1730829
// Implementation Authors: K. Vardis, G. Papaioannou

#version 330 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
#define NUM_VIEWS __NUM_VIEWS__
uniform sampler2D sampler_depth[NUM_VIEWS];
uniform sampler2D sampler_normal;
uniform sampler3D sampler_noise;
uniform mat4 uniform_view[NUM_VIEWS];
uniform mat4 uniform_proj[NUM_VIEWS];
uniform mat4 uniform_proj_inverse[NUM_VIEWS];
uniform mat4 uniform_view_inverse[NUM_VIEWS];
uniform vec3 uniform_view_position[NUM_VIEWS];
uniform float uniform_range;
#define NUM_SAMPLES __NUM_SAMPLES__
uniform vec3 uniform_samples[NUM_SAMPLES];
#define IS __IS__

//#define IS_HEATMAP
#include "random_number.h"
#include "normal_compression.h"

// returns the eye space position for this fragment
// index = 0 the camera view
vec3 reconstruct_position_from_depth()
{
	vec4 pndc = vec4(2 * vec3(TexCoord.xy, texture(sampler_depth[0], TexCoord.xy).r) - 1, 1);
	vec4 pecs = uniform_proj_inverse[0] * pndc;
	pecs.xyz = pecs.xyz/pecs.w;
	return pecs.xyz;
}

void calculate_view(int view_index, int start, int end, vec3 pwcs, mat2 rot, out float view_occlusion, out float view_distance)
{
	view_occlusion = 0.0;
	view_distance = 0.0;
	float divsamples = 1 / float(end-start);

	vec3 pecs = (uniform_view[view_index] * vec4(pwcs, 1.0)).xyz;

	float max_volume = 0;

	for (int sample_index = start; sample_index < end; sample_index++) 
	{
		//Create ecs disk sample
		vec3 cur_sample = pecs.xyz + vec3(rot * uniform_samples[sample_index].xy * uniform_range, 0);
				
		// project ecs sample to clip space
		vec4 pndc_sample = uniform_proj[view_index] * vec4(cur_sample.xyz, 1.0f);
		pndc_sample /= pndc_sample.w;		
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
		
		// sample the depth buffer
		float sample_depth = texture(sampler_depth[view_index], pndc_sample.xy).r;

		// unproject sampled depth to ecs
		vec4 pecs_sample_z = uniform_proj_inverse[view_index] * vec4(2*pndc_sample.xy-1, 2*sample_depth-1, 1.0f);
		pecs_sample_z /= pecs_sample_z.w;

		float dist = distance(pecs_sample_z.z, pecs.z);
		dist = (pndc_sample.z < sample_depth) ? 0.0: uniform_range;
		//dist = min(dist, uniform_range);		
		
		float zs = uniform_samples[sample_index].z * uniform_range;

		// find length of ray to depth
		float dist_pecs_z = pecs_sample_z.z - cur_sample.z;

		// find length of ray from sample to either depth or to the projection to front unit hemisphere
		float length_line = max(min(dist_pecs_z, zs) + zs, 0);
		
		// multiply length of line by the area patch for each sample
		view_occlusion += length_line;
		max_volume += 2 * zs;
		view_distance += dist;
	}

	view_occlusion /= max_volume;

	view_distance = 1 - (view_distance * divsamples / uniform_range);
}

void main(void)
{
	float current_depth = texture(sampler_depth[0], TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(1,1,1,1); return;
	}
	
	// retrieve normal information from our normal buffer
	vec3 normal_unclamped_wcs = vec4(uniform_view_inverse[0] * vec4(normal_decode_spheremap1(texture(sampler_normal, TexCoord.xy).xy), 0.0)).rgb;
	normal_unclamped_wcs = normalize(normal_unclamped_wcs);

	// get the fragment's world space position
	vec3 pwcs = vec4(uniform_view_inverse[0] * vec4(reconstruct_position_from_depth(), 1)).xyz;

	// Sample a noise pattern to get a random rotation and sample offset
	vec3 seed = 13 *pwcs.xyz+pwcs.xzy + 17*vec3(TexCoord.xy, 1);
	vec3 random_rotation = rand3n(13 * seed.xy + 17 * seed.xz).xyz;
	//vec3 random_rotation = texture(sampler_noise, 17 * seed).xyz;
	random_rotation.x *= 2.0 * 3.1415936;

	float cosr = cos(random_rotation.x);
	float sinr = sin(random_rotation.x);

	mat2 rot = mat2(cosr, -sinr, 
					 sinr, cosr);

	// Initialize obscurance and bent normal

	// final results
	float total_occlusion = 0.0; 
	pwcs += 0.05 * 1 * normal_unclamped_wcs;

	// view results
	float view_occlusion = 0.0;

	// view bias parameters
	float normal_bias_weight = 0.0;
	float distance_bias_weight = 1 - normal_bias_weight;

	// to avoid division by zero
	float camera_bias = 0.001;
	vec3 view_dir = vec3(0.0, 0.0, 0.0);
	
	float view_normal_bias = 0.0;
	float view_distance_bias = 0.0;
	int view_index = 0;
	float view1_occlusion = 0.0;
	float view2_occlusion = 0.0;
	float view3_occlusion = 0.0;
	float view1_weights = 0.0;
	float view2_weights = 0.0;
	float view3_weights = 0.0;
	
#if IS == 1
	int init_samples = int(NUM_SAMPLES * 0.3);
#else
	int init_samples = NUM_SAMPLES;
#endif
	// VIEW 1
	// MVAO calculation for camera
	// The same approach is followed for each view
	// In the case of IS we take an initial number of samples up to 1/3 of total samples and use the calculated occlusion 
	// and weights to estimate if this view requires any more samples in a second pass
	// 1. set view_index for current view
	view_index = 0;
	// 2. estimate directional weight
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	// 3. set initial number of samples
	int view1_samples = init_samples;
	// 4. estimate obscurance, bent normal and distance weight for current view
	calculate_view(view_index, 0, view1_samples, pwcs, rot, view_occlusion, view_distance_bias);
	// 5. modulate the weights with the bias parameters
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	// 6. calculate the total weight for the current view
	view1_weights = view_normal_bias + view_distance_bias + camera_bias;
	// 7. save partial occlusion and bent normal
	view1_occlusion = view_occlusion;

#if (NUM_VIEWS>1)
	// VIEW 2
	// MVAO calculation for view 1 (same as above)
	view_index = 1;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view2_samples = init_samples;
	calculate_view(view_index, 0, view1_samples, pwcs, rot, view_occlusion, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view2_weights = view_normal_bias + view_distance_bias;
	view2_occlusion = view_occlusion;
#endif
	
#if (NUM_VIEWS>2)
	// VIEW 3
	// MVAO calculation for view 2 (same as above)
	view_index = 2;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view3_samples = init_samples;
	calculate_view(view_index, 0, view1_samples, pwcs, rot, view_occlusion, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view3_occlusion = view_occlusion;
	view3_weights = view_normal_bias + view_distance_bias;
#endif

#if IS == 1
	// VIEW 1
	// MVAO IS calculation for camera
	// sampling estimation based on previous results
	// if we have an open area (low occlusion), we need not to sample further. Otherwise perform a second pass.
	int num_samples1 = int(floor( 1+(NUM_SAMPLES-init_samples)*(0.5*view1_occlusion+0.5)*view1_weights/(view1_weights+view2_weights+view3_weights)));
	// The following calculations are the same as before
	int adaptive_index = 0;
	vec3 adaptive_bent_normal=vec3(0.0,0.0,0.0);
	float adaptive_occlusion=0.0;
	calculate_view(adaptive_index, init_samples, init_samples+num_samples1, pwcs, rot, adaptive_occlusion, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	float adaptive_weights = view_normal_bias + view_distance_bias;
	view1_occlusion = (view1_occlusion*init_samples+adaptive_occlusion*num_samples1)/(init_samples+num_samples1);
	view1_weights = (view1_weights*init_samples + adaptive_weights*num_samples1)/(init_samples+num_samples1);
	view1_bent_normal += adaptive_bent_normal;
#if (NUM_VIEWS>1)	
	// VIEW 2
	// MVAO IS calculation for view 1 (same as above)
	int num_samples2 = int(floor(1+(NUM_SAMPLES-init_samples)*(0.5*view2_occlusion+0.5)*view2_weights/(view1_weights+view2_weights+view3_weights)));
	adaptive_index = 1;
	calculate_view(adaptive_index, init_samples, init_samples+num_samples2, pwcs, rot, adaptive_occlusion, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	adaptive_weights = view_normal_bias + view_distance_bias;
	view2_occlusion = (view2_occlusion*init_samples+adaptive_occlusion*num_samples2)/(init_samples+num_samples2);
	view2_weights = (view2_weights*init_samples + adaptive_weights*num_samples2)/(init_samples+num_samples2);
	view2_bent_normal += adaptive_bent_normal;
#endif
#if (NUM_VIEWS>2)
	// VIEW 3
	// MVAO IS calculation for view 2 (same as above)
	int num_samples3 = int(floor(1+(NUM_SAMPLES-init_samples)*(0.5*view3_occlusion+0.5)*view3_weights/(view1_weights+view2_weights+view3_weights)));
	adaptive_index = 2;
	calculate_view(adaptive_index, init_samples, init_samples+num_samples3, pwcs, rot, adaptive_occlusion, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	adaptive_weights = view_normal_bias + view_distance_bias;
	view3_occlusion = (view3_occlusion*init_samples+adaptive_occlusion*num_samples3)/(init_samples+num_samples3);
	view3_weights = (view3_weights*init_samples + adaptive_weights*num_samples3)/(init_samples+num_samples3);
#endif
#endif	
	
	// calculate total occlusion based on partial obscurance results and weights

	total_occlusion = view1_occlusion * view1_weights + view2_occlusion * view2_weights + view3_occlusion * view3_weights;
	total_occlusion /= view1_weights + view2_weights + view3_weights;

	total_occlusion = 1 - total_occlusion;

	total_occlusion += 0.5;
	total_occlusion = clamp(total_occlusion, 0, 1);

	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
	//out_color = vec4(view1_weights/(view1_weights + view2_weights + view3_weights), view2_weights/(view1_weights + view2_weights + view3_weights), view3_weights/(view1_weights + view2_weights + view3_weights), total_occlusion);
	//out_color = vec4((num_samples1+init_samples)/15.0, (num_samples2+init_samples)/15.0, (num_samples3+init_samples)/15.0,total_occlusion);
	//out_color = vec4(1,1,1,1)*(num_samples1+num_samples2+0+2*init_samples)/30.0;
}
