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
	
	vec3 normal_unclamped_wcs = vec4(uniform_view_inverse * vec4(normal_decode_spheremap1(texture2D(sampler_normal, TexCoord.xy).xy), 0.0)).rgb;
	normal_unclamped_wcs = normalize(normal_unclamped_wcs);

	vec3 pwcs = vec4(uniform_view_inverse * vec4(reconstruct_position_from_depth(), 1)).xyz;
	
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
	
	float rotation_scale = 0.5*(random_rotation.y + random_rotation.z) * uniform_range;
	//pwcs += 0.05 * uniform_range * normal_unclamped_wcs;
	pwcs += 0.05 * 1 * normal_unclamped_wcs;
	
	float total_occlusion = 0.0;
	vec3 bent_normal = normalize(normal_unclamped_wcs) * 0.1;
	float divsamples = 1 / float(uniform_num_samples);
	
	mat4 view_vp = uniform_proj * uniform_view;

	for (int sample_index = 0; sample_index < uniform_num_samples; sample_index++)
	{
		//float normalizer = sample_index * divsamples;
		// get random vector to 0->1 length
		//random_vector = uniform_samples[sample_index] * (random_rotation.xyz + normalizer) * 0.5;

		//vec3 pwcs_scaled_by_range = vec3(pwcs.xyz / uniform_range);
		//vec3 seed = vec3(normalizer + pwcs.xyz * vec3(4.13, 3.7, 2.97));
		//vec3 offset_jittering = texture(sampler_noise, seed.xyz).xyz;
		//random_vector = normalize(2 * offset_jittering.xyz - 1);
		// get random samples to 0->1 length
		//random_vector *= normalizer;
		//random_vector *= (offset_jittering.z + normalizer) * 0.5 * uniform_range;
		//random_vector += normalize(normal_unclamped_wcs) * 0.1;

		// reflect vector if in other direction
		//random_vector *= sign(dot(normal_unclamped_wcs, random_vector));

		// Create wcs hemisphere sample
		// cur_sample = original_point + randomly rotated vector
		//vec3 cur_sample = pwcs.xyz + rotation_scale * random_vector;
		vec3 cur_sample = pwcs + rotation_scale * (vec_u*uniform_samples[sample_index].x + vec_v*uniform_samples[sample_index].y + normal_unclamped_wcs * uniform_samples[sample_index].z);
	
		// get the new vector from world space to clip space
		vec4 pndc_sample = view_vp * vec4(cur_sample.xyz, 1.0);
		pndc_sample /= pndc_sample.w;
		pndc_sample.xyz = (pndc_sample.xyz + 1) * 0.5;

		// grab the sample depth and transform it to view space
		float sample_depth = texture2D(sampler_depth, pndc_sample.xy).r;
				
		// check if sample is occluded (or if sampled depth has higher value in the depth buffer)
		// transform sample clip xyz coordinates to world space
		vec4 pecs_sample = uniform_proj_inverse * vec4(2 * pndc_sample.xyz - 1, 1.0);
		pecs_sample = pecs_sample/pecs_sample.w;
		// transform sample clip xy coordinates to world space with depth buffer value
		vec4 pecs_z_sample = uniform_proj_inverse * vec4(2 * vec3(pndc_sample.xy, sample_depth) - 1, 1.0);
		pecs_z_sample = pecs_z_sample/pecs_z_sample.w;
		
		vec4 pecs = uniform_view * vec4(pwcs.xyz, 1);
		bool is_visible = pecs_sample.z > pecs_z_sample.z;
		//bool outside_radius = abs(pecs_sample.z - pecs_z_sample.z) >= uniform_range;
		//bool outside_radius = distance(pecs_z_sample, pecs) >= uniform_range;
		bool outside_radius = ((pecs_z_sample.x - pecs.x) * (pecs_z_sample.x - pecs.x) + 
							  (pecs_z_sample.y - pecs.y) * (pecs_z_sample.y - pecs.y) + 
							  (pecs_z_sample.z - pecs.z) * (pecs_z_sample.z - pecs.z)) >= (uniform_range * uniform_range);

		total_occlusion += (is_visible || outside_radius)? 1.0: 0.0;
		bent_normal += (is_visible || outside_radius)? normalize(pecs_sample.xyz - pecs.xyz): vec3(0.0, 0.0, 0.0);
	}

	total_occlusion *= divsamples;

	//total_occlusion *= total_occlusion;

	bent_normal = normalize(bent_normal);
	
	bent_normal.xyz = vec3(0.5 + bent_normal.xy * 0.5, bent_normal.z);

	out_color = vec4(bent_normal, total_occlusion);
	//out_color = vec4(total_occlusion, total_occlusion, total_occlusion, total_occlusion);
	//out_color = vec4(normal_unclamped_ecs.xyz, 1);
}
