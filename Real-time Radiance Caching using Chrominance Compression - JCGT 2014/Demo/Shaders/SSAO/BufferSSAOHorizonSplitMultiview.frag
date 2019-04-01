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
// Multi-view HSAO, based on the Image-Space Horizon-Based Ambient Occlusion method by Louis Bavoil
// (Image-Space Horizon-Based Ambient Occlusion, Siggraph 2008)
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
uniform int uniform_num_slices;
uniform int uniform_num_samples;
uniform float uniform_range;
uniform int uniform_num_views;

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

void calculate_view(int view_index, int start, int end, vec3 pwcs, vec3 random_rotation, vec3 tangent_wcs, vec3 bitangent_wcs, vec3 normal_unclamped_wcs, out float view_occlusion, out vec3 view_bent_normal, out float view_distance)
{
	mat4 view_vp = uniform_proj[view_index] * uniform_view[view_index];
	mat4 view_vp_inverse = uniform_view_inverse[view_index] * uniform_proj_inverse[view_index];

	float sliceStep = (2.0 * 3.1415936) / float(uniform_num_slices);
	float sample_step = uniform_range / float(uniform_num_samples);

	view_distance = 0;
	view_bent_normal = normal_unclamped_wcs * uniform_num_slices * uniform_num_samples * 0.5; 
	view_occlusion = 0.0;

	float current_angle = 0;
	for (int slice_index = 0; slice_index < uniform_num_slices; slice_index++)
	{
		// create ray based on current angle
		// working on tangent space to simplify calculations and then convert back to eye space
		vec3 horizon_dir = tangent_wcs * cos(current_angle + random_rotation.x) + bitangent_wcs * sin(current_angle + random_rotation.x);

		float elevation_angle = 0;
		float elevation_distance = 0;
		for (int sample_index = 1; sample_index <= uniform_num_samples; ++sample_index)
		{
			// create sample in world space based on ray direction and radius
			vec3 cur_sample = pwcs.xyz + horizon_dir * ((sample_index-random_rotation.y) * sample_step);

			// project sample onto screen space
			vec4 pndc_sample = view_vp * vec4(cur_sample.xyz, 1.0f);
			pndc_sample /= pndc_sample.w;
			pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
			pndc_sample.xyz = clamp(pndc_sample.xyz, 0.0, 1.0);

			// sample the depth buffer
			float sample_depth = texture2D(sampler_depth[view_index], pndc_sample.xy).r;

			// unproject the point to get it to world space
			vec4 pwcs_sample_z = view_vp_inverse * vec4(2 * pndc_sample.xy - 1, 2 * sample_depth - 1, 1.0);
			pwcs_sample_z /= pwcs_sample_z.w;

			// create a vector from pixel point P to sampled point
			vec3 sampled_point_dir = normalize(pwcs_sample_z.xyz - pwcs.xyz);
			
			// find the angle between the pixel to sampled point vector and the original direction vector
			float sample_elevation_angle = max(0.0, dot(sampled_point_dir, normal_unclamped_wcs));

			float distance_point_to_sample =  distance(pwcs.xyz, pwcs_sample_z.xyz);
			bool larger_than_radius = distance_point_to_sample > uniform_range;

			float dist = min(distance_point_to_sample, uniform_range);
			dist = (pndc_sample.z < sample_depth) ? min(dist, uniform_range) : uniform_range;
			view_distance += dist;

			if (elevation_angle < sample_elevation_angle && !larger_than_radius)
			{
				elevation_angle = sample_elevation_angle;
				horizon_dir = sampled_point_dir;
				elevation_distance = distance_point_to_sample;
			}
			view_bent_normal += (pndc_sample.z < sample_depth)? normalize(cur_sample - pwcs):vec3(0,0,0);
		}
		
		// evaluate the inner integral which is sin(elevation_angle) - sin(ray_dir_angle)
		// since the ray_dir_angle is 0, so sin(0) = 0, the second part is omitted
		//float attenuation =  1 - ((elevation_distance/uniform_range));
		//attenuation = clamp(attenuation, 0.0, 1.0);
		view_occlusion += elevation_angle * 1;

		// bent normal should be vertical to the horizon dir
		//vec3 ver_to_normal_hor = cross(horizon_dir, normal_unclamped_wcs);
		//vec3 horizon_bent_normal = cross(ver_to_normal_hor, horizon_dir);
		//view_bent_normal += horizon_bent_normal + normal_unclamped_wcs;// attenuation * horizon_dir + (1 - attenuation) * normal_unclamped_ecs;

		// increase angle
		current_angle += sliceStep;
	}

	// evaluate the outer integral using constant approximation
	view_occlusion /= float(uniform_num_slices);

	view_distance = 1 - (view_distance / (uniform_num_slices * uniform_num_samples * uniform_range));
}

void main(void)
{
	float current_depth = texture2D(sampler_depth[0], TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(1,1,1,1); return;
	}

	vec3 normal_unclamped_wcs = vec4(uniform_view_inverse[0] * vec4(normal_decode_spheremap1(texture2D(sampler_normal, TexCoord.xy).xy), 0.0)).rgb;
	normal_unclamped_wcs = normalize(normal_unclamped_wcs);

	vec3 pwcs = vec4(uniform_view_inverse[0] * vec4(reconstruct_position_from_depth(), 1)).xyz;
	
	float occlude_factor = 0.0f;
	
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
	vec3 random_rotation = texture(sampler_noise, 10 *(pwcs.xyz+0.7*pwcs.xzy) + 10*vec3(TexCoord.xy, 1)).xyz;
	random_rotation.x *= 2.0 * 3.1415936;

	pwcs += 0.05 * 1 * normal_unclamped_wcs;

	float sliceStep = (2.0 * 3.1415936) / float(uniform_num_slices);
	float sample_step = uniform_range / float(uniform_num_samples);

	// final results
	float total_occlusion = 0.0; 
	vec3 total_bent_normal = vec3(0.0, 0.0, 0.0); 

	// view results
	float view_occlusion = 0.0;
	vec3 view_bent_normal = vec3(0.0, 0.0, 0.0);

	// view bias parameters
	float normal_bias_weight = 0.1;
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
	vec3 view1_bent_normal = vec3(0.0, 0.0, 0.0);
	vec3 view2_bent_normal = vec3(0.0, 0.0, 0.0);
	vec3 view3_bent_normal = vec3(0.0, 0.0, 0.0);

#ifdef IS
	int init_samples = uniform_num_samples;
#else
	int init_samples = uniform_num_samples;
#endif
	// VIEW 1
	view_index = 0;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view1_samples = init_samples;
	calculate_view(view_index, 0, view1_samples, pwcs, random_rotation, tangent_wcs, bitangent_wcs, normal_unclamped_wcs, view_occlusion, view_bent_normal, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *= normal_bias_weight;
	view1_weights = view_normal_bias + view_distance_bias + camera_bias;
	view1_occlusion = view_occlusion;
	view1_bent_normal = view_bent_normal;
	
#if (NUM_VIEWS>1)
	// VIEW 2
	view_index = 1;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view2_samples = init_samples;
	calculate_view(view_index, 0, view2_samples, pwcs, random_rotation, tangent_wcs, bitangent_wcs, normal_unclamped_wcs, view_occlusion, view_bent_normal, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view2_weights = view_normal_bias + view_distance_bias + camera_bias;
	view2_occlusion = view_occlusion;
	view2_bent_normal = view_bent_normal;
#endif
	
	// VIEW 3
#if (NUM_VIEWS>2)
	view_index = 2;
	view_dir = normalize(uniform_view_position[view_index] - pwcs);
	view_normal_bias = max(0.0, dot(normal_unclamped_wcs, view_dir));
	int view3_samples = init_samples;
	calculate_view(view_index, 0, view3_samples, pwcs, random_rotation, tangent_wcs, bitangent_wcs, normal_unclamped_wcs, view_occlusion, view_bent_normal, view_distance_bias);
	view_distance_bias *= distance_bias_weight;
	view_normal_bias *=  normal_bias_weight;
	view3_occlusion = view_occlusion;
	view3_weights = view_normal_bias + view_distance_bias + camera_bias;
	view3_bent_normal = view_bent_normal;
#endif

	total_occlusion = view1_occlusion * view1_weights + view2_occlusion * view2_weights + view3_occlusion * view3_weights;
	total_occlusion /= view1_weights + view2_weights + view3_weights;

	total_occlusion = 1 - total_occlusion;

	//total_occlusion *= total_occlusion;

	total_bent_normal = view1_bent_normal * view1_weights + view2_bent_normal * view2_weights + view3_bent_normal * view3_weights;
	total_bent_normal = normalize(total_bent_normal);

	total_bent_normal = vec3(uniform_view[0] * vec4(total_bent_normal, 0)).xyz;
	total_bent_normal.xyz = vec3(0.5+total_bent_normal.x/2.0, 0.5+total_bent_normal.y/2.0,total_bent_normal.z);

	out_color = vec4(total_bent_normal.xyz,total_occlusion);
	out_color = vec4(total_occlusion, total_occlusion, total_occlusion, total_occlusion);
	//out_color = vec4(view1_weights/(view1_weights + view2_weights + view3_weights), view2_weights/(view1_weights + view2_weights + view3_weights), view3_weights/(view1_weights + view2_weights + view3_weights), total_occlusion);
}
