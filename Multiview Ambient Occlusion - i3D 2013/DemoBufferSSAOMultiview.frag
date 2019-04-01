// Multi-view SSAO, based on the Screen Space Ambient Occlusion method by Vladimir Kajalin
// (Screen Space Ambient Occlusion, ShaderX7)
// Author: K. Vardis, G. Papaioannou

#version 330 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_depth[4];
uniform sampler2D sampler_normal;
uniform sampler3D sampler_noise;
uniform mat4 uniform_view[4];
uniform mat4 uniform_proj[4];
uniform mat4 uniform_proj_inverse[4];
uniform mat4 uniform_view_inverse[4];
uniform vec3 uniform_view_position[4];
uniform int uniform_num_samples;
uniform float uniform_range;
uniform int uniform_num_views;
uniform vec3 uniform_samples[15];

//#define IS 1
#define NUM_VIEWS 3

// uncompressing the normal
vec3 pixel_to_normal_unpack(vec3 pixel)
{
	return normalize(vec3(2.0 * pixel.rg - 1.0, pixel.b));
}

// returns the eye space position for this fragment
// index = 0 the camera view
vec3 reconstruct_position_from_depth()
{
	vec4 pndc = vec4(2 * vec3(TexCoord.xy, texture2D(sampler_depth[0], TexCoord.xy).r) - 1, 1);
	vec4 pecs = uniform_proj_inverse[0] * pndc;
	pecs.xyz = pecs.xyz/pecs.w;
	return pecs.xyz;
}

// calculate_view-> this function is called for each view separately and calculates the occlusion using our modified Alchemy AO alghorithm
// we use world_space to generate our samples to reduce the number of matrix multiplications between world space and each view's eye and clip coordinate system
// view_index -> the index of our view to check (0 camera, 1,2,3 are phantom or light views
// this index is used to access the uniform arrays containing matrix information for each view
// start, end -> start and end indices for importance sampling (IS). If IS is not enabled, these are start = 0, end = uniform_num_samples
// pwcs -> the world space position for this fragment
// rotation_scale -> a random number ranging from 0 to uniform_range
// vec_u, vec_v -> randomly rotated vectors in the pixels tangential space
// normal_unclamped_wcs -> the normal in world space for this fragment
// view_occlusion -> output for this view_index occlusion
// view_bent_normal -> output for this view_index bent normal
// view_distance -> output for this view_index distance weight
void calculate_view(int view_index, int start, int end, vec3 pwcs, float rotation_scale, vec3 vec_u, vec3 vec_v, vec3 normal_unclamped_wcs, out float view_occlusion, out vec3 view_bent_normal, out float view_distance)
{
	view_occlusion = 0.0;
	view_bent_normal = 0.1 * normal_unclamped_wcs;
	view_distance = 0.0;
	float divsamples = 1 / float(end-start);
	vec3 random_vector = vec3(0.0, 0.0, 0.0);
	
	mat4 view_vp = uniform_proj[view_index] * uniform_view[view_index];
	mat4 view_p_inverse = uniform_proj_inverse[view_index];

	for (int sample_index = start; sample_index < end; sample_index++)
	{
		// Create wcs hemisphere sample
		// cur_sample = original_point + scale(0->1) * range * randomly rotated vector in tangential hemisphere of original point of radius 1
		vec3 cur_sample = pwcs + rotation_scale * (vec_u*uniform_samples[sample_index].x + vec_v*uniform_samples[sample_index].y + normal_unclamped_wcs * uniform_samples[sample_index].z);
			
		// project wcs sample to clip space (whichever that is)
		vec4 pndc_sample = view_vp * vec4(cur_sample.xyz, 1.0f);
		pndc_sample /= pndc_sample.w;
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;

		// sample the depth buffer
		float sample_depth = texture2D(sampler_depth[view_index], pndc_sample.xy).r;

		// check if sample is occluded (or if sampled depth has higher value in the depth buffer)
		// transform sample clip xyz coordinates to eye space
		vec4 pecs_sample = view_p_inverse * vec4(2 * pndc_sample.xyz - 1, 1.0f);
		pecs_sample /= pecs_sample.w;
			
		// transform sample clip xy coordinates to world space with depth buffer value
		vec4 pecs_z_sample = view_p_inverse * vec4(2 * vec3(pndc_sample.xy, sample_depth) - 1, 1.0f);
		pecs_z_sample /= pecs_z_sample.w;
		
		// measure the sample distance to the lit point (hemisphere center)
		vec4 pecs = uniform_view[view_index] * vec4(pwcs, 1);
		
		bool is_visible = pecs_sample.z > pecs_z_sample.z;
		bool outside_radius = distance(pecs_z_sample, pecs) >= uniform_range;
				
		view_occlusion += (is_visible || outside_radius)? 1.0: 0.0;
				
		vec3 bent_normal = (is_visible || outside_radius)? normalize(pecs_sample.xyz - pecs.xyz): vec3(0.0, 0.0, 0.0);

		view_bent_normal += vec3(uniform_view_inverse[view_index] * vec4(bent_normal, 0)).xyz;

		float dist = distance(pecs_z_sample.xyz, pecs.xyz);
		dist = (pndc_sample.z < sample_depth) ? min(dist, uniform_range) : uniform_range;

		view_distance += dist;
	}

	view_occlusion *= divsamples;

	// normalize the distance weight	
	view_distance = 1 - (view_distance * divsamples / uniform_range);
}

void main(void)
{
	// discard pixel if it does not belong in the scene
	float current_depth = texture2D(sampler_depth[0], TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(1,1,1,1); return;
	}
	
	// retrieve normal information from our normal buffer
	vec3 normal_unclamped_wcs = vec4(uniform_view_inverse[0] * vec4(pixel_to_normal_unpack(texture2D(sampler_normal, TexCoord.xy).rgb), 0.0)).rgb;
	normal_unclamped_wcs = normalize(normal_unclamped_wcs);

	// get the fragment's world space position
	vec3 pwcs = vec4(uniform_view_inverse[0] * vec4(reconstruct_position_from_depth(), 1)).xyz;
	
	// calculate tangent, bitangent
	vec3 tangent_wcs = vec3(1.0, 0.0, 0.0);
	vec3 bitangent_wcs = vec3(0.0, 1.0, 0.0);

	// if normal is (0,1,0) use (1,0,0)
	if (abs(normal_unclamped_wcs.z) < 0.001 && abs(normal_unclamped_wcs.x) < 0.001)
	{
		bitangent_wcs = normalize(cross(normal_unclamped_wcs, tangent_wcs));
		tangent_wcs = normalize(cross(normal_unclamped_wcs, bitangent_wcs));
	}
	else
	{
		tangent_wcs = normalize(cross(normal_unclamped_wcs, bitangent_wcs));
		bitangent_wcs = normalize(cross(normal_unclamped_wcs, tangent_wcs));
	}
	
	// Sample a noise pattern to get a random rotation and sample offset
	vec3 random_rotation = texture(sampler_noise, 10 *pwcs.xyz+pwcs.xzy + 20*vec3(TexCoord.xy, 1)).xyz;
	random_rotation.x *= 2.0 * 3.1415936;

	// Create a rotate version of the tangential coordinate system:
	// (right_ecs,front_ecs) -> (vec_u,vec_v). The normal remains unchanged
	vec3 vec_u = tangent_wcs * cos(random_rotation.x) + bitangent_wcs * sin(random_rotation.x);
	vec3 vec_v = cross(vec_u, normal_unclamped_wcs);
	
	// random number between 0 and uniform_range
	float rotation_scale = 0.5*(random_rotation.y + random_rotation.z) * uniform_range;

	// offset our world space position by a small amount
	pwcs += 0.05 * 1 * normal_unclamped_wcs;

	// Initialize obscurance, weights and bent normal parameters
	float view_normal_bias = 0.0;
	float view_distance_bias = 0.0;
	int view_index = 0;
	float view1_occlusion = 0.0;
	float view2_occlusion = 0.0;
	float view3_occlusion = 0.0;
	float view1_weights = 0.0;
	float view2_weights = 0.0;
	float view3_weights = 0.0;
	vec3 view1_bent_normal = vec3(0.0, 0.0, 0.0);
	vec3 view2_bent_normal = vec3(0.0, 0.0, 0.0);
	vec3 view3_bent_normal = vec3(0.0, 0.0, 0.0);
	
	// to avoid division by zero
	float camera_bias = 0.0001;
	vec3 view_dir = vec3(0.0, 0.0, 0.0);

	// view bias parameters
	float normal_bias_weight = 0.0;
	float distance_bias_weight = 1 - normal_bias_weight;

	// partial results
	float view_occlusion = 0.0;
	vec3 view_bent_normal = vec3(0.0, 0.0, 0.0);

	// final results
	float total_occlusion = 0.0; 
	vec3 total_bent_normal = vec3(0.0, 0.0, 0.0); 

#ifdef IS
	int init_samples = 7;
#else
	int init_samples = 15;
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
	calculate_view(view_index, 0, view1_samples, pwcs, rotation_scale, vec_u, vec_v, normal_unclamped_wcs, view_occlusion, view_bent_normal, view_distance_bias);
	// 5. modulate the weights with the bias parameters
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	// 6. calculate the total weight for the current view
	view1_weights = view_normal_bias + view_distance_bias + camera_bias;
	// 7. save partial occlusion and bent normal
	view1_occlusion = view_occlusion;
	view1_bent_normal = view_bent_normal;

#if (NUM_VIEWS>1)
	// VIEW 2
	// MVAO calculation for view 1 (same as above)
	view_index = 1;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view2_samples = init_samples;
	calculate_view(view_index, 0, view2_samples, pwcs, rotation_scale, vec_u, vec_v, normal_unclamped_wcs, view_occlusion, view_bent_normal, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view2_weights = view_normal_bias + view_distance_bias + camera_bias;
	view2_occlusion = view_occlusion;
	view2_bent_normal = view_bent_normal;
#endif
	
#if (NUM_VIEWS>2)
	// VIEW 3
	// MVAO calculation for view 2 (same as above)
	view_index = 2;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view3_samples = init_samples;
	calculate_view(view_index, 0, view3_samples, pwcs, rotation_scale, vec_u, vec_v, normal_unclamped_wcs, view_occlusion, view_bent_normal, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view3_occlusion = view_occlusion;
	view3_weights = view_normal_bias + view_distance_bias + camera_bias;
	view3_bent_normal = view_bent_normal;
#endif
	
#ifdef IS
	// VIEW 1
	// MVAO IS calculation for camera
	// sampling estimation based on previous results
	// if we have an open area (low occlusion), we need not to sample further. Otherwise perform a second pass.
	int num_samples1 = int(floor( 1+(uniform_num_samples-init_samples)*(0.5 + 0.5*(1-view1_occlusion))*view1_weights/(view1_weights+view2_weights+view3_weights)));
	// The following calculations are the same as before
	int adaptive_index = 0;
	vec3 adaptive_bent_normal=vec3(0.0,0.0,0.0);
	float adaptive_occlusion=0.0;
	calculate_view(adaptive_index, init_samples, init_samples+num_samples1, pwcs, rotation_scale, vec_u, vec_v, normal_unclamped_wcs, adaptive_occlusion, adaptive_bent_normal, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	float adaptive_weights = view_normal_bias + view_distance_bias + camera_bias;
	view1_occlusion = (view1_occlusion*init_samples+adaptive_occlusion*num_samples1)/(init_samples+num_samples1);
	view1_weights = (view1_weights*init_samples + adaptive_weights*num_samples1)/(init_samples+num_samples1);
	view1_bent_normal += adaptive_bent_normal;
#if (NUM_VIEWS>1)	
	// VIEW 2
	// MVAO IS calculation for view 2 (same as above)
	int num_samples2 = int(floor(1+(uniform_num_samples-init_samples)*(0.5 + 0.5*(1-view2_occlusion))*view2_weights/(view1_weights+view2_weights+view3_weights)));
	adaptive_index = 1;
	calculate_view(adaptive_index, init_samples, init_samples+num_samples2, pwcs, rotation_scale, vec_u, vec_v, normal_unclamped_wcs, adaptive_occlusion, adaptive_bent_normal, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	adaptive_weights = view_normal_bias + view_distance_bias + camera_bias;
	view2_occlusion = (view2_occlusion*init_samples+adaptive_occlusion*num_samples2)/(init_samples+num_samples2);
	view2_weights = (view2_weights*init_samples + adaptive_weights*num_samples2)/(init_samples+num_samples2);
	view2_bent_normal += adaptive_bent_normal;
#endif
#if (NUM_VIEWS>2)
	// VIEW 3
	// MVAO IS calculation for view 3 (same as above)
	int num_samples3 = int(floor(1+(uniform_num_samples-init_samples)*(0.5 + 0.5*(1-view3_occlusion))*view3_weights/(view1_weights+view2_weights+view3_weights)));
	adaptive_index = 2;
	calculate_view(adaptive_index, init_samples, init_samples+num_samples3, pwcs, rotation_scale, vec_u, vec_v, normal_unclamped_wcs, adaptive_occlusion, adaptive_bent_normal, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	adaptive_weights = view_normal_bias + view_distance_bias + camera_bias;
	view3_occlusion = (view3_occlusion*init_samples+adaptive_occlusion*num_samples3)/(init_samples+num_samples3);
	view3_weights = (view3_weights*init_samples + adaptive_weights*num_samples3)/(init_samples+num_samples3);
	view3_bent_normal += adaptive_bent_normal;
#endif
#endif
	
	// calculate total occlusion based on partial obscurance results and weights
	total_occlusion = view1_occlusion * view1_weights + view2_occlusion * view2_weights + view3_occlusion * view3_weights;
	total_occlusion /= view1_weights + view2_weights + view3_weights;

	//total_occlusion *= total_occlusion;

	// back to camera eye space
	// calculate total bent normal based on partial bent normal results and weights
	total_bent_normal = view1_bent_normal * view1_weights + view2_bent_normal * view2_weights + view3_bent_normal * view3_weights;
	total_bent_normal = normalize(total_bent_normal);

	// back to camera eye space
	total_bent_normal = vec4(uniform_view[0] * vec4(total_bent_normal,0)).xyz;
	total_bent_normal.xyz = vec3(0.5 + total_bent_normal.xy * 0.5, total_bent_normal.z);
	
	// save bent normal in RGB channels and occlusion in A
	out_color = vec4(total_bent_normal.xyz, total_occlusion);
	// save only occlusion for testing purposes
	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
	// save weights for testing purposes
	//out_color = vec4((num_samples1+init_samples)/15.0, (num_samples2+init_samples)/15.0, (num_samples3+init_samples)/15.0,total_occlusion);
}