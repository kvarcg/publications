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
uniform sampler2D sampler_depth;
uniform sampler2D sampler_normal;
uniform sampler3D sampler_noise;
uniform mat4 uniform_proj;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform int uniform_num_samples;
uniform float uniform_range;
uniform vec3 uniform_samples[15];

vec2 normal_encode_xy(vec2 normal)
{
	return vec2(0.5 + normal.xy * 0.5);
}

vec2 normal_decode_xy(vec2 normal)
{
	return vec2(2.0 * normal.xy - 1.0);
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
	vec4 pndc = vec4(2 * vec3(TexCoord.xy, texture2D(sampler_depth, TexCoord.xy).r) - 1, 1);
	vec4 pecs = uniform_proj_inverse * pndc;
	pecs.xyz = pecs.xyz/pecs.w;
	return pecs.xyz;
}

void main(void)
{
	float current_depth = texture2D(sampler_depth, TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(1,1,1,1); return;
	}
		
	vec3 normal_unclamped_ecs = normal_decode_spheremap1(texture2D(sampler_normal, TexCoord.xy).xy);

	vec3 pecs = reconstruct_position_from_depth();
	
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
	vec3 random_rotation = texture(sampler_noise, 10 * (pecs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0))).xyz;
	random_rotation.x *= 2.0 * 3.1415936;

	// Create a rotate version of the tangential coordinate system:  
	// (right_ecs,front_ecs) -> (vec_u,vec_v). The normal remains unchanged
	vec3 vec_u = tangent_ecs * cos(random_rotation.x) + bitangent_ecs * sin(random_rotation.x); 
	vec3 vec_v = cross(vec_u, normal_unclamped_ecs); 

	// Initialize obscurance and bent normal
	float total_occlusion = 0.0; 
	vec3 total_bent_normal = 0.1 * normal_unclamped_ecs; 
	float angle = 1;
	float rotation_scale = 0.5*(random_rotation.y + random_rotation.z) * uniform_range;
	pecs += 0.05 * normal_unclamped_ecs;
	float divsamples = 1 / float(uniform_num_samples);

	for (int sample_index = 0; sample_index < uniform_num_samples; sample_index++) 
	{ 
		//Create ecs hemisphere sample
		vec3 cur_sample = pecs + rotation_scale * (vec_u*uniform_samples[sample_index].x + vec_v*uniform_samples[sample_index].y + normal_unclamped_ecs * uniform_samples[sample_index].z);
		//float normalizer = sample_index * divsamples;
		//Create ecs disk sample
		//cur_sample = pecs.xyz + normalizer * vec3(rot * uniform_samples[sample_index].xy * uniform_range, 0);
		
		// project ecs sample to clip space
		vec4 pndc_sample = uniform_proj * vec4(cur_sample.xyz, 1.0);
		pndc_sample /= pndc_sample.w;
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
		
		// sample the depth buffer
		float sample_depth = texture2D(sampler_depth, pndc_sample.xy).r;

		// move sample on surface 
		// unproject the point to get it to eye space
		vec4 pecs_sample_z = uniform_proj_inverse * vec4(2 * vec3(pndc_sample.xy, sample_depth) - 1, 1.0);
		pecs_sample_z /= pecs_sample_z.w;
		
		// measure the sample distance to the lit point (hemisphere center)
		float dist = distance(pecs_sample_z.xyz, pecs); 
		//float dist  = ((pecs_sample_z.x - pecs.x) * (pecs_sample_z.x - pecs.x) + 
					   //(pecs_sample_z.y - pecs.y) * (pecs_sample_z.y - pecs.y) + 
					   //(pecs_sample_z.z - pecs.z) * (pecs_sample_z.z - pecs.z));
		
		// Estimate occlusion 
		// create a vector from pixel point P to sampled point
		vec3 sampled_point_dir = normalize(pecs_sample_z.xyz - pecs.xyz);

		angle = max(0.0, dot(sampled_point_dir, normal_unclamped_ecs));
		
		float sample_occlusion = (dist < uniform_range)? angle:0.0;
		vec3 bent_normal = (pndc_sample.z < sample_depth)? normalize(cur_sample - pecs):vec3(0,0,0);
		// Estimate bent normal based on original hemisphere sample, NOT the one projected on the surface 
		//total_bent_normal += (sample_occlusion > 0.0)? bent_normal:vec3(0,0,0);
		//if (dist < uniform_range)
		//total_bent_normal += bent_normal;
		//total_bent_normal += reflect(bent_normal,normal_unclamped_ecs)  * out_of_range;
		
		// Compute attenuation function (if any). 
		// IMHO, no attenuation function gives more reliable and pleasing results, so I skip this
		//float u_ = 0.05 * uniform_range; 
		//total_occlusion += u_ * 3.14 * sample_occlusion * divsamples / (max(u_*u_,dist));
		total_occlusion += sample_occlusion;
	} 

	total_occlusion *= divsamples;
	total_occlusion = 1 - total_occlusion;

	//total_occlusion *= total_occlusion;

	// Adjust output range and store results.
	total_bent_normal = normalize(total_bent_normal); 
	total_bent_normal.xyz = vec3(normal_encode_xy(total_bent_normal.xy), total_bent_normal.z);
	out_color = vec4(total_bent_normal.xyz, total_occlusion);
	//out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
}
