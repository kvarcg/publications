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
// VO, based on the Volumetric Obscurance method by Bradford James Loos
// (Volumetric Obscurance, i3D 2010)
// Author: G. Papaioannou, K. Vardis
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
uniform int uniform_num_views;
uniform vec3 uniform_samples[15];

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
	normal_unclamped_ecs = normalize(normal_unclamped_ecs);

	vec3 pecs = reconstruct_position_from_depth();
	
	// Sample a noise pattern to get a random rotation and sample offset
	vec3 random_rotation = texture(sampler_noise, 10 * (pecs.xyz + vec3(2 * TexCoord.xy - 1, 1)-vec3(0.5,0.5,0.0))).xyz;
	random_rotation.x *= 2.0 * 3.1415936;

	float cosr = cos(random_rotation.x);
	float sinr = sin(random_rotation.x);

	mat2 rot = mat2(cosr, -sinr, sinr, cosr);

	// Initialize obscurance and bent normal
	float total_occlusion = 0.0; 
	pecs += 0.05 * 1 * normal_unclamped_ecs;

	float cylinder_volume_perc = 3.14 * uniform_range * uniform_range / uniform_num_samples;
	float divsamples = 1.0 / float(uniform_num_samples);

	float max_volume = 0;
	float avg_distance = 0;
	for (int sample_index = 0; sample_index < uniform_num_samples; sample_index++) 
	{ 
		float normalizer = sample_index * divsamples;
		//Create ecs disk sample
		vec3 cur_sample = pecs.xyz + normalizer * vec3(rot * uniform_samples[sample_index].xy * uniform_range, 0);
				
		// project ecs sample to clip space
		vec4 pndc_sample = uniform_proj * vec4(cur_sample.xyz, 1.0);
		pndc_sample /= pndc_sample.w;		
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;
		
		// sample the depth buffer
		float sample_depth = texture2D(sampler_depth, pndc_sample.xy).r;

		// unproject sampled depth to ecs
		vec4 pecs_sample_z = uniform_proj_inverse * vec4(2*pndc_sample.xy-1, 2*sample_depth-1, 1.0);
		pecs_sample_z /= pecs_sample_z.w;

		float zs = uniform_samples[sample_index].z * uniform_range;

		// find length of ray to depth
		float dist_pecs_z = pecs_sample_z.z - cur_sample.z;

		// find length of ray from sample to either depth or to the projection to front unit hemisphere
		float length_line = max(min(dist_pecs_z, zs) + zs, 0);

		// multiply length of line by the area patch for each sample
		total_occlusion += length_line;
		max_volume += 2 * zs;
	} 

	total_occlusion /= max_volume;

	total_occlusion = 1 - total_occlusion;

	total_occlusion += 0.5;
	total_occlusion*=total_occlusion;
	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);return;

	// Adjust output range and store results.
	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
}
