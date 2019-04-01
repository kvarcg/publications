//----------------------------------------------------//
//													  // 
// Copyright: Athens University of Economics and	  //
// Business											  //
// Authors: Kostas Vardis, Georgios Papaioannou   	  //
// 													  //
// If you use this code as is or any part of it in    //
// any kind of project or product, please acknowledge // 
// the source and its authors.						  //
//                                                    //
//----------------------------------------------------//
// Multi-view VO, based on the Volumetric Obscurance method by Bradford James Loos
// (Volumetric Obscurance, i3D 2010)
// Author: G. Papaioannou, K. Vardis
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

vec2 normal_encode_xy(vec3 normal)
{
	return vec2(0.5+normal.xy*0.5);
}

vec2 normal_encode_spheremap1(vec3 normal)
{
	float f = sqrt(8*normal.z+8);
    return normal.xy / f + 0.5;
}

vec2 normal_encode_spheremap2(vec3 normal)
{
	vec2 enc = normalize(normal.xy) * (sqrt(-normal.z*0.5+0.5));
    enc = enc*0.5+0.5;
    return enc;
}

vec3 normal_decode_spheremap1(vec2 pixel)
{
	vec2 fenc = pixel*4-2;
    float f = dot(fenc,fenc);
    float g = sqrt(1-f/4);
    vec3 n;
    n.xy = fenc*g;
    n.z = 1-f/2;
    return n;
}

vec3 normal_decode_spheremap2(vec2 pixel)
{
	vec4 nn = vec4(2*pixel.rg-1,1,-1);
    float l = dot(nn.xyz,-nn.xyw);
    nn.z = l;
    nn.xy *= sqrt(l);
    return nn.xyz * 2 + vec3(0,0,-1);
}

vec3 reconstruct_position_from_depth()
{
	vec4 pndc = vec4(2 * vec3(TexCoord.xy, texture2D(sampler_depth[0], TexCoord.xy).r) - 1, 1);
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
		float normalizer = sample_index * divsamples;
		//Create ecs disk sample
		vec3 cur_sample = pecs.xyz + normalizer * vec3(rot * uniform_samples[sample_index].xy * uniform_range, 0);
				
		// project ecs sample to clip space
		vec4 pndc_sample = uniform_proj[view_index] * vec4(cur_sample.xyz, 1.0f);
		pndc_sample /= pndc_sample.w;		
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
		
		// sample the depth buffer
		float sample_depth = texture2D(sampler_depth[view_index], pndc_sample.xy).r;

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
	float current_depth = texture2D(sampler_depth[0], TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(1,1,1,1); return;
	}
	
	// it is preferrable to work in WCS rathen than camera ECS since we are going to tranform points to different
	// clipping spaces and it will save instructions below
	//vec3 normal_unclamped_wcs_top = vec4(uniform_view_inverse[0] * vec4(pixel_to_normal_unpack(normal_emmisive_color.rgb), 1.0)).rgb;
	//vec3 normal_unclamped_wcs_orig = vec4(uniform_view_inverse[0] * vec4(0,0,0,1)).rgb;
	//vec3 normal_unclamped_wcs = normal_unclamped_wcs_top - normal_unclamped_wcs_orig;
	//normal_unclamped_wcs = normalize(normal_unclamped_wcs);
	vec3 normal_unclamped_wcs = vec4(uniform_view_inverse[0] * vec4(normal_decode_spheremap1(texture2D(sampler_normal, TexCoord.xy).xy), 0.0)).rgb;
	normal_unclamped_wcs = normalize(normal_unclamped_wcs);
	
	vec3 pwcs = vec4(uniform_view_inverse[0] * vec4(reconstruct_position_from_depth(), 1)).xyz;

	// Sample a noise pattern to get a random rotation and sample offset
	vec3 random_rotation = texture(sampler_noise, 10 * (pwcs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0))).xyz;
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

#ifdef IS
	int init_samples = 5;
#else
	int init_samples = 15;
#endif
	// VIEW 1
	view_index = 0;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view1_samples = init_samples;
	calculate_view(view_index, 0, view1_samples, pwcs, rot, view_occlusion, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view1_weights = view_normal_bias + view_distance_bias + camera_bias;
	view1_occlusion = view_occlusion;
	
#if (NUM_VIEWS>1)
	// VIEW 2
	view_index = 1;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view2_samples = init_samples;
	calculate_view(view_index, 0, view2_samples, pwcs, rot, view_occlusion, view_distance_bias);
	view_distance_bias *= view_distance_bias;
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view2_weights = view_normal_bias + view_distance_bias + camera_bias;
	view2_occlusion = view_occlusion;
#endif
	
	// VIEW 3
#if (NUM_VIEWS>2)
	view_index = 2;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view3_samples = init_samples;
	calculate_view(view_index, 0, view3_samples, pwcs, rot, view_occlusion, view_distance_bias);
	view_distance_bias *= view_distance_bias;
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view3_occlusion = view_occlusion;
	view3_weights = view_normal_bias + view_distance_bias + camera_bias;
#endif

#ifdef IS
	int adaptive_index = 0;
	vec3 adaptive_bent_normal=vec3(0.0,0.0,0.0);
	float adaptive_occlusion=0.0;
	int num_samples1 = int(floor( 1+(uniform_num_samples-init_samples)*(0.5*view1_occlusion+0.5)*view1_weights/(view1_weights+view2_weights+view3_weights)));
	calculate_view(adaptive_index, init_samples, init_samples+num_samples1, pwcs, rot, adaptive_occlusion, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	float adaptive_weights = view_normal_bias + view_distance_bias + camera_bias;
	view1_occlusion = (view1_occlusion*init_samples+adaptive_occlusion*num_samples1)/(init_samples+num_samples1);
	view1_weights = (view1_weights*init_samples + adaptive_weights*num_samples1)/(init_samples+num_samples1);
#if (NUM_VIEWS>1)	
	adaptive_index = 1;
	int num_samples2 = int(floor(1+(uniform_num_samples-init_samples)*(0.5*view2_occlusion+0.5)*view2_weights/(view1_weights+view2_weights+view3_weights)));
	calculate_view(adaptive_index, init_samples, init_samples+num_samples2, pwcs, rot, adaptive_occlusion, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	adaptive_weights = view_normal_bias + view_distance_bias + camera_bias;
	view2_occlusion = (view2_occlusion*init_samples+adaptive_occlusion*num_samples2)/(init_samples+num_samples2);
	view2_weights = (view2_weights*init_samples + adaptive_weights*num_samples2)/(init_samples+num_samples2);
#endif
#if (NUM_VIEWS>2)
	adaptive_index = 2;
	int num_samples3 = int(floor(1+(uniform_num_samples-init_samples)*(0.5*view3_occlusion+0.5)*view3_weights/(view1_weights+view2_weights+view3_weights)));
	calculate_view(adaptive_index, init_samples, init_samples+num_samples3, pwcs, rot, adaptive_occlusion, view_distance_bias);
	view_dir = normalize(uniform_view_position[adaptive_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir)) * normal_bias_weight;
	view_distance_bias *= distance_bias_weight;
	adaptive_weights = view_normal_bias + view_distance_bias + camera_bias;
	view3_occlusion = (view3_occlusion*init_samples+adaptive_occlusion*num_samples3)/(init_samples+num_samples3);
	view3_weights = (view3_weights*init_samples + adaptive_weights*num_samples3)/(init_samples+num_samples3);
#endif
#endif	
	
	total_occlusion = view1_occlusion * view1_weights + view2_occlusion * view2_weights + view3_occlusion * view3_weights;
	total_occlusion /= view1_weights + view2_weights + view3_weights;

	total_occlusion = 1 - total_occlusion;

	total_occlusion += 0.5;

	total_occlusion*=total_occlusion;

	//total_occlusion*=total_occlusion;

	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
	//out_color = total_color;
	//out_color = vec4(view1_weights/(view1_weights + view2_weights + view3_weights), view2_weights/(view1_weights + view2_weights + view3_weights), view3_weights/(view1_weights + view2_weights + view3_weights), total_occlusion);
	//out_color = vec4((num_samples1+init_samples)/15.0, (num_samples2+init_samples)/15.0, (num_samples3+init_samples)/15.0,total_occlusion);
	//out_color = vec4(1,1,1,1)*(num_samples1+num_samples2+0+2*init_samples)/30.0;
}
