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
#extension GL_EXT_gpu_shader4 : enable

layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_normal;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_occlusion;
uniform sampler2D sampler_depth;
uniform sampler2D sampler_noise;
uniform sampler2DArray sampler_shadow_map;
uniform vec3 light_color;
uniform vec3 light_direction;
uniform float light_size;
uniform float shadow_map_resolution;
uniform float uniform_constant_bias;

uniform mat4 uniform_view;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_light_view;
uniform mat4 uniform_light_projection[8];
uniform int uniform_light_projection_number;
uniform float light_size_ratio[8];


float saturate(float value)
{
	return clamp(value, 0.0, 1.0);
}

vec3 pixel_to_normal_unpack(vec3 pixel)
{
	return normalize(vec3(pixel.rg * 2.0 - 1.0, pixel.b));
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

float directional_lighting_color_phong(vec3 L, vec3 N)
{
	return max(dot(N, L), 0.0);
}

float directional_lighting_color_half_lambert(vec3 L, vec3 N)
{
	return max(0.5 * (1.0 + dot(N, L)), 0.0);
}

vec3 calc_reflection_vector(vec3 L, vec3 N)
{
	return normalize((2.0*N*dot(N, L)) - L);
}

float phong_specular(vec3 L, vec3 V, vec3 N, float surface_smoothness)
{
	vec3 R = calc_reflection_vector(L, N);

	float thdotv = max(dot(R, V), 0.0);

	return pow(thdotv, surface_smoothness);
}

float phong_blinn_specular(vec3 L, vec3 V, vec3 N, float surface_smoothness)
{
	vec3 H = normalize(L + V);

	float hdotv = max(dot(H, N), 0.0);

	return pow(hdotv, surface_smoothness);
}

vec3 reconstruct_position_from_depth()
{
	vec4 pndc = vec4(2 * vec3(TexCoord.xy, texture2D(sampler_depth, TexCoord.xy).r) - 1, 1);
	vec4 pecs = uniform_proj_inverse * pndc;
	pecs.xyz = pecs.xyz/pecs.w;
	return pecs.xyz;
}

// 1 sample per pixel
float shadow_nearest(vec3 light_space_xyz, float slice)
{
	// sample shadow map
	float shadow_map_z = texture2DArray(sampler_shadow_map, vec3(light_space_xyz.xy, slice)).r;

	//if (light_space_z - uniform_constant_bias > shadow_map_z) return 0.0;
	//else return 1.0;

	// + shaded -> 0.0 
	// - lit -> 1.0
	return clamp(-sign((light_space_xyz.z - uniform_constant_bias) - shadow_map_z), 0.0, 1.0);
}

// 9 sample per pixel fixed kernel
//float shadow_pcf_3x3(vec3 light_space_xyz, int slice)
//{
	//// + shaded -> 0.0f 
	//// - lit -> 1.0f
	//float shadow_map_z_center = texture2DArray(sampler_shadow_map, light_space_xyz.xy).r;
	//if (light_space_xyz.z - uniform_constant_bias - shadow_map_z_center > 0)
	//{
		//float shadow_map_step = 0.5/shadow_map_resolution;
		//float sum = 0.0f;
		//// [-1, +1]
		//float shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(- shadow_map_step, + shadow_map_step)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// [0, +1]
		//shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(0.0f, + shadow_map_step)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// [+1, -1]
		//shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(+ shadow_map_step, + shadow_map_step)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// [-1, 0]
		//shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(- shadow_map_step, 0.0)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// [+1, 0]
		//shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(+ shadow_map_step, 0.0)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// [-1, -1]
		//shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(- shadow_map_step, - shadow_map_step)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// [0, -1]
		//shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(0.0, - shadow_map_step)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// [+1, +1]
		//shadow_map_z = texture2DArray(sampler_shadow_map, light_space_xyz.xy + vec2(+ shadow_map_step, + shadow_map_step)).r;
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
		//// the center
		//sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z_center), 0.0, 1.0);
//
		//sum = sum / 9.0f;
		//return sum;
	//}
	//else return 1.0f;
//}

float shadow_pcf_2x2_bilinear_interpolation(vec3 light_space_xyz, float slice)
{
	float shadow_map_step = 0.5/shadow_map_resolution;
	vec2 t = fract(shadow_map_resolution * light_space_xyz.xy+vec2(0.5,0.5));
	float shadow_map_z;
	float test = 0.0;
	shadow_map_z = texture2DArray(sampler_shadow_map, vec3(light_space_xyz.xy+vec2(shadow_map_step,shadow_map_step), slice)).r;
	test = (t.x)*(t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	shadow_map_z = texture2DArray(sampler_shadow_map, vec3(light_space_xyz.xy+vec2(-shadow_map_step,shadow_map_step), slice)).r;
	test += (1-t.x)*(t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	shadow_map_z = texture2DArray(sampler_shadow_map, vec3(light_space_xyz.xy+vec2(-shadow_map_step,-shadow_map_step), slice)).r;
	test += (1-t.x)*(1-t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	shadow_map_z = texture2DArray(sampler_shadow_map, vec3(light_space_xyz.xy+vec2(shadow_map_step,-shadow_map_step), slice)).r;
	test += (t.x)*(1-t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	return test;
}

float kernel[32];
// gaussian kernel
void initGaussKernel()
{
	// left is x values, right is y values
	kernel[ 0] =  0.5000; kernel[ 1] =  0.0000;
	kernel[ 2] =  0.3536; kernel[ 3] =  0.3536;
	kernel[ 4] =  0.0000; kernel[ 5] =  0.5000;
	kernel[ 6] = -0.3536; kernel[ 7] =  0.3536;
	kernel[ 8] = -0.5000; kernel[ 9] =  0.0000;
	kernel[10] = -0.3536; kernel[11] = -0.3536;
	kernel[12] = -0.0000; kernel[13] = -0.5000;
	kernel[14] =  0.3536; kernel[15] = -0.3536;
	kernel[16] =  0.9808; kernel[17] =  0.1951;
	kernel[18] =  0.5556; kernel[19] =  0.8315;
	kernel[20] = -0.1951; kernel[21] =  0.9808;
	kernel[22] = -0.8315; kernel[23] =  0.5556;
	kernel[24] = -0.9808; kernel[25] = -0.1951;
	kernel[26] = -0.5556; kernel[27] = -0.8315;
	kernel[28] =  0.1951; kernel[29] = -0.9808;
	kernel[30] =  0.8315; kernel[31] = -0.5556;
};

void initPoissonKernel()
{
	// left is x values, right is y values
	kernel[ 0] =  0.6380579;      kernel[ 1] =  0.4449583;
	kernel[ 2] =  0.6931192;      kernel[ 3] = -0.1381737;
	kernel[ 4] =  0.1144824;      kernel[ 5] =  0.9875048;
	kernel[ 6] =  0.1098847;      kernel[ 7] =  0.4336814;
	kernel[ 8] =  0.3143708;      kernel[ 9] =  0.0361301;
	kernel[10] = -0.1026169;      kernel[11] = -0.5163488;
	kernel[12] = -0.4126734;      kernel[13] = -0.1538523;
	kernel[14] =  0.3008616;      kernel[15] = -0.5039347;
	kernel[16] = -0.9169297;      kernel[17] = -0.3045053;
	kernel[18] = -0.3270000;      kernel[19] =  0.5143743;
	kernel[20] = -0.8440755;      kernel[21] =  0.5065118;
	kernel[22] = -0.5660912;      kernel[23] = -0.5446975;
	kernel[24] = -0.1061198;      kernel[25] = -0.9898314;
	kernel[26] =  0.3757758;      kernel[27] = -0.9038967;
	kernel[28] =  0.7827652;      kernel[29] = -0.5708858;
	kernel[30] = -0.7437519;      kernel[31] =  0.1136564;
}

float shadow_pcf_gaussian(vec3 light_space_xyz, float slice)
{
	initPoissonKernel();

	float shadow_map_z = texture2DArray(sampler_shadow_map, vec3(light_space_xyz.xy, slice)).r;
	
	float radius = 0.5 + (light_size * light_size_ratio[int(slice)])* (abs(light_space_xyz.z - shadow_map_z) / shadow_map_z);
	//radius = 1 + light_size * ((light_space_xyz.z - shadow_map_z)/light_space_xyz.z);

	vec2 offset;
	float test=0.0;
	int numSamples = 16;
	int i = 0;

	vec2 offset_jittering = 0.2 * texture2D(sampler_noise, 20 * (light_space_xyz.xy-vec2(0.5,0.5))).xy;
	float costheta = cos(offset_jittering.x * 6.28);
	float sintheta = sin(offset_jittering.x * 6.28);
	mat2 rotX = mat2(vec2(costheta, sintheta), vec2(-sintheta, costheta));
		
	float weight_total = 0.0;

	float res = 0.0;//clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0f, 1.0f);	

	for (i=0; i<numSamples; i++)
	{
		vec2 _kernel = vec2(kernel[2*i],kernel[2*i+1]);
		_kernel = rotX * _kernel;
		float dist =  length(_kernel);
		float weight = exp(-dist * dist);
		offset = radius * (_kernel + offset_jittering);
		vec2 texel_offset = offset/float(shadow_map_resolution);
		float shadow_map_z = texture2DArray(sampler_shadow_map, vec3(light_space_xyz.xy + texel_offset, slice)).r;
		// constant depth bias
	    //res += (clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0) * weight);
		// slope _bias
		//float slope_bias = abs((texel_offset.x * d_anal_z_to_du_dv.x)) + abs((texel_offset.y * d_anal_z_to_du_dv.y)) + 0.001;
		//res += (clamp(-sign(light_space_xyz.z - slope_bias - shadow_map_z),0.0,1.0) * weight);
		res += (clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0) * weight);
		weight_total += weight;
	}
	res += test;
	res /= weight_total;

	return res;
	
	// + shaded -> 0.0
	// - lit -> 1.0
	return 1.0;
}

bool existsInCascade(int i, out vec4 plcs, vec4 pwcs)
{
	plcs = uniform_light_projection[i] * uniform_light_view * pwcs;
	plcs /= plcs.w;
	
	// check that we are inside light clipping frustum
	return (clamp(plcs.xy, vec2(-1,-1), vec2(1,1)) - plcs.xy) == vec2(0,0);
}

float sampleCascade(vec3 plcs, float slice)
{
	plcs.xyz = (plcs.xyz + 1) * 0.5;
	//return shadow_nearest(plcs.xyz, slice);
	//return shadow_pcf_2x2_bilinear_interpolation(plcs.xyz, slice);
	return shadow_pcf_gaussian(plcs.xyz, slice);
}

float shadow(vec3 pecs)
{
	vec4 pwcs = uniform_view_inverse * vec4(pecs, 1);
	float shadowFactor = 0.0;
	
	bool inside = false;
	for (int i = 0; i < uniform_light_projection_number; ++i)
	{
		vec4 plcs;
		inside = existsInCascade(i, plcs, pwcs);

		if (inside)
		{
			shadowFactor = sampleCascade(plcs.xyz, float(i));

			// is it near the edge?
			float offset = 0.2;
			bool in_band_zone = clamp(abs(plcs.x), 1-offset, 1) - abs(plcs.x) == 0;
			in_band_zone = in_band_zone || clamp(abs(plcs.y), 1-offset, 1) - abs(plcs.y) == 0;
			if (!in_band_zone) return shadowFactor;

			vec2 dist = vec2((vec2(1,1) - abs(plcs.xy))/offset);
			inside = existsInCascade((i+1), plcs, pwcs);

			if (inside)
			{
				float max_dist = min(dist.x, dist.y);
				float shadowFactor2 = sampleCascade(plcs.xyz, float(i + 1));
				return mix(shadowFactor2, shadowFactor, max_dist);
			}
			else
				return shadowFactor;		
		}
	}

	return shadowFactor;
}

vec3 shadowCascadeColor(vec3 pecs)
{
	vec3 cascade_colors[8];
	cascade_colors[0] = vec3(1.0, 0.2, 0.2);
	cascade_colors[1] = vec3(0.2, 1.0, 0.2);
	cascade_colors[2] = vec3(0.2 ,0.2, 1.0);
	cascade_colors[3] = vec3(1.0, 0.2, 1.0);
	cascade_colors[4] = vec3(1.0, 1.0, 0.2);
	cascade_colors[5] = vec3(1.0 ,1.0, 1.0);
	cascade_colors[6] = vec3(1.0, 0.7, 0.2);
	cascade_colors[7] = vec3(0.2, 1.0, 0.7);

	vec4 pwcs = uniform_view_inverse * vec4(pecs, 1);
	vec3 shadowColor = vec3(0.0, 0.0, 0.0);
	
	bool inside = false;
	for (int i = 0; i < uniform_light_projection_number; ++i)
	{
		vec4 plcs;
		inside = existsInCascade(i, plcs, pwcs);

		if (inside)
		{
			shadowColor = cascade_colors[i];

			// is it near the edge?
			float offset = 0.1;
			bool in_band_zone = clamp(abs(plcs.x), 1-offset, 1) - abs(plcs.x) == 0;
			in_band_zone = in_band_zone || clamp(abs(plcs.y), 1-offset, 1) - abs(plcs.y) == 0;
			if (!in_band_zone) return shadowColor;

			vec2 dist = vec2((vec2(1,1) - abs(plcs.xy))/offset);
			inside = existsInCascade(i+1, plcs, pwcs);

			if (inside)
			{
				float max_dist = min(dist.x, dist.y);
				return mix(cascade_colors[i+1], cascade_colors[i], max_dist);
			}
			else
				return shadowColor;		
		}
	}

	return shadowColor;
}

void main(void)
{
	float current_depth = texture2D(sampler_depth, TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(0,0,0,1); return;
	}

	vec4 kd = texture2D(sampler_albedo, TexCoord.xy);
	vec2 normal_packed = texture2D(sampler_normal, TexCoord.xy).xy;
	vec3 normal_unclamped = normal_decode_spheremap1(normal_packed.rg);

	vec4 specular_exp = texture2D(sampler_specular, TexCoord.xy);
	vec3 ks = specular_exp.xyz;

	float surface_smoothness = specular_exp.a * 127.0;

	vec4 occlusion = texture2D(sampler_occlusion, TexCoord.xy);
	vec3 normal_bent_unclamped = pixel_to_normal_unpack(occlusion.rgb);

	vec3 view_direction = vec3(0,0,1);
	vec4 light_direction_ecs = normalize((uniform_view * vec4(-light_direction,0)));
	
	float ndotl = directional_lighting_color_phong(normal_unclamped.xyz, light_direction_ecs.xyz);

	float ndotl_occ = directional_lighting_color_phong(normal_bent_unclamped.xyz, light_direction_ecs.xyz);
	//float ndotl = directional_lighting_color_half_lambert(normal_unclamped.xyz, light_direction_ecs.xyz);
	ndotl_occ = clamp(ndotl_occ, 0.0, 1.0);

	//vec3 specular = phong_specular(light_direction_ecs.xyz, view_direction, normal_unclamped, surface_smoothness) * ks;
	vec3 specular = phong_blinn_specular(light_direction_ecs.xyz, view_direction, normal_unclamped, surface_smoothness) * ks;

	vec3 dirColor = (kd.rgb + specular) * light_color.rgb * ndotl;

	vec3 pecs = reconstruct_position_from_depth();
	float shadowFactor = shadow(pecs);
	//vec3 shadowFactor = shadowCascadeColor(pecs);
	dirColor *= shadowFactor;
	
	dirColor *= occlusion.a * occlusion.a;

	//dirColor += light_color.rgb * ndotl_occ * 0.2;

	//shadowFactor.x = shadow(pecs);
	//dirColor *= shadowFactor;
	//dirColor = vec3(ndotl_occ,ndotl_occ,ndotl_occ);
	//dirColor = vec3(ndotl,ndotl,ndotl);

	out_color = vec4(dirColor.rgb,1);
}
