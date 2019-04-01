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
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform int uniform_num_samples;
uniform int uniform_num_slices;
uniform float uniform_range;

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
	
	vec2 random_rotation = texture(sampler_noise, 10 *(pecs.xyz+0.7*pecs.xzy) + 10*vec3(TexCoord.xy, 1)).xy;
	random_rotation.x *= 2.0 * 3.1415936;
	
	pecs += 0.05 * 1 * normal_unclamped_ecs;

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
			float sample_depth = texture2D(sampler_depth, pndc_sample.xy).r;

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

	//total_occlusion *= total_occlusion;

	total_bent_normal = normalize(total_bent_normal);
	
	total_bent_normal.xyz = vec3(0.5+total_bent_normal.x/2.0, 0.5+total_bent_normal.y/2.0,total_bent_normal.z);

	out_color = vec4(total_bent_normal.xyz,total_occlusion);
	out_color = vec4(total_occlusion,total_occlusion,total_occlusion,total_occlusion);
}
