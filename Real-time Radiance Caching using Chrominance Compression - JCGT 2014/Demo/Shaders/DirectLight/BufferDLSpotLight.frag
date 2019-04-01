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
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_normal;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_occlusion;
uniform sampler2D sampler_depth;
uniform sampler2D sampler_noise;
uniform sampler2D sampler_shadow_map;
uniform vec3 light_color;
uniform vec3 light_position;
uniform vec3 light_direction;
uniform int light_is_conical;
uniform float uniform_light_cosine_umbra;
uniform float uniform_light_cosine_penumbra;
uniform float uniform_spotlight_exponent;
uniform float light_size;
uniform float shadow_map_resolution;
uniform bool shadows_enabled;
uniform vec2 uniform_samples[16];
uniform float uniform_constant_bias;

uniform mat4 uniform_view;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_light_view;
uniform mat4 uniform_light_projection;

float saturate(float value)
{
	return clamp(value, 0.0, 1.0);
}

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

vec3 normal_decode_xy(vec2 pixel)
{
	pixel.rg = vec2(pixel.rg * 2 - 1);
	float f = sqrt(1 - dot(pixel.rg, pixel.rg));
	return vec3(pixel.rg, f);
}

vec3 normal_unpack_xy(vec3 pixel)
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

vec3 normal_decode_spheremap2(vec2 pixel)
{
	vec4 nn = vec4(2*pixel.rg-1,1,-1);
	float l = dot(nn.xyz,-nn.xyw);
	nn.z = l;
	nn.xy *= sqrt(l);
	return nn.xyz * 2 + vec3(0,0,-1);
}

float directional_lighting_color_phong(vec3 L, vec3 N)
{
	return max(dot(N, L), 0.0);
}

float directional_lighting_color_half_lambert(vec3 L, vec3 N)
{
	return max(0.5 * (1.0 + dot(N, L)), 0.0);
}

// both vectors are looking away from point X
vec3 calc_reflection_vector(vec3 V, vec3 N)
{
	return normalize((2.0*N*dot(N, V)) - V);
}

float phong_specular(vec3 L, vec3 V, vec3 N, float surface_smoothness)
{
	vec3 R = calc_reflection_vector(L, N);

	float thdotv = max(dot(R, V), 0.01);

	// normalized phong brdf
	return pow(thdotv, surface_smoothness) * (surface_smoothness + 2) / (2 * 3.14);
}

float phong_blinn_specular(vec3 L, vec3 V, vec3 N, float surface_smoothness)
{
	vec3 H = normalize(L + V);
	
	float hdotv = max(dot(H, N), 0.01);
	
	// normalized blinn-phong brdf
	return pow(hdotv, surface_smoothness) * (surface_smoothness + 8) / (8 * 3.14);
}

vec3 reconstruct_position_from_depth()
{
	vec4 pndc = vec4(2 * vec3(TexCoord.xy, texture2D(sampler_depth, TexCoord.xy).r) - 1, 1);
	vec4 pecs = uniform_proj_inverse * pndc;
	pecs.xyz = pecs.xyz/pecs.w;
	return pecs.xyz;
}

float check_spotlight(vec3 vertex_to_light_direction_ecs)
{
	float spoteffect = 1;
	if (light_is_conical == 1)
	{
		vec3 light_direction_ecs = normalize((uniform_view * vec4(light_direction, 0)).xyz);
		float angle_vertex_spot_dir = dot(normalize(-vertex_to_light_direction_ecs), light_direction_ecs);

		// if angle is less than the penumbra (cosine is reverse)
		// if angle is between the penumbra region
		// if angle is outside the umbra region
		if (angle_vertex_spot_dir >= uniform_light_cosine_penumbra) 
			spoteffect = 1;
		else if (uniform_light_cosine_penumbra > angle_vertex_spot_dir && uniform_light_cosine_umbra < angle_vertex_spot_dir)
		{
			float attenuate = (angle_vertex_spot_dir - uniform_light_cosine_umbra) / (uniform_light_cosine_penumbra - uniform_light_cosine_umbra);
			spoteffect = pow(attenuate, uniform_spotlight_exponent);
		}
		else spoteffect = 0;
	}
	return spoteffect;
}

vec2 d_anal_z_to_du_dv;
void initSlopeBias(vec3 plcs)
{
	// take derivatives on 2x2 block of pixels
	// derivative of distance to light source with respect to screen x,y
	float d_anal_z_to_dx = dFdx(plcs.z);
	float d_anal_z_to_dy = dFdy(plcs.z);
	// derivative of texture u coordinate with respect to screen x,y
	float d_u_to_dx = dFdx(plcs.x);
	float d_u_to_dy = dFdy(plcs.x);
	// derivative of texture v coordinate with respect to screen x,y
	float d_v_to_dx = dFdx(plcs.y);
	float d_v_to_dy = dFdy(plcs.y);

	// build jacobian matrix
	mat2 jac = mat2(d_u_to_dx, d_v_to_dx, d_u_to_dy, d_v_to_dy);
	mat2 jac_inv_tr = inverse(transpose(jac));

	float invDet = 1 / (0.2 + (d_u_to_dx * d_v_to_dy) - (d_u_to_dy * d_v_to_dx));
	//Top row of 2x2
	vec2 ddist_duv;
	ddist_duv.x = d_v_to_dy * d_anal_z_to_dx ; // invJtrans[0][0] * ddist_dx
	ddist_duv.x -= d_v_to_dx * d_anal_z_to_dy ; // invJtrans[0][1] * ddist_dy
	//Bottom row of 2x2
	ddist_duv.y = d_u_to_dx * d_anal_z_to_dx ;   // invJtrans[1][1] * ddist_dy
	ddist_duv.y -= d_u_to_dy * d_anal_z_to_dy ;  // invJtrans[1][0] * ddist_dx
	ddist_duv *= invDet;

	// derivative of distance to light source with respect to texture coordinates
	d_anal_z_to_du_dv = ddist_duv;
	//d_anal_z_to_du_dv = jac_inv_tr * vec2(d_anal_z_to_dx, d_anal_z_to_dy);
}

// 1 sample per pixel
float shadow_nearest(vec3 light_space_xyz)
{
	// sample shadow map
	float shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy).r;

	//if (light_space_z - uniform_constant_bias > shadow_map_z) return 0.0;
	//else return 1.0;

	// + shaded -> 0.0 
	// - lit -> 1.0
	return clamp(-sign((light_space_xyz.z - uniform_constant_bias) - shadow_map_z), 0.0, 1.0);
}

// 9 sample per pixel fixed kernel
float shadow_pcf_3x3(vec3 light_space_xyz)
{
	// + shaded -> 0.0 
	// - lit -> 1.0
	float shadow_map_step = 1.5/shadow_map_resolution;
	float sum = 0.0;
	// the center
	float shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, +1]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(- shadow_map_step, + shadow_map_step)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, +1]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(0.0, + shadow_map_step)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, -1]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(+ shadow_map_step, + shadow_map_step)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, 0]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(- shadow_map_step, 0.0)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, 0]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(+ shadow_map_step, 0.0)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [-1, -1]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(- shadow_map_step, - shadow_map_step)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [0, -1]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(0.0, - shadow_map_step)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);
	// [+1, +1]
	shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + vec2(+ shadow_map_step, + shadow_map_step)).r;
	sum += clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);

	sum = sum / 9.0;
	return sum;
}

float shadow_pcf_2x2_bilinear_interpolation(vec3 light_space_xyz)
{
	float shadow_map_step = 1.5/shadow_map_resolution;
	vec2 t = fract(shadow_map_resolution * light_space_xyz.xy+vec2(0.5,0.5));
	float shadow_map_z;
	float test = 0.0;
	shadow_map_z = texture2D(sampler_shadow_map,light_space_xyz.xy+vec2(shadow_map_step,shadow_map_step)).r;
	test = (t.x)*(t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	shadow_map_z = texture2D(sampler_shadow_map,light_space_xyz.xy+vec2(-shadow_map_step,shadow_map_step)).r;
	test += (1-t.x)*(t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	shadow_map_z = texture2D(sampler_shadow_map,light_space_xyz.xy+vec2(-shadow_map_step,-shadow_map_step)).r;
	test += (1-t.x)*(1-t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	shadow_map_z = texture2D(sampler_shadow_map,light_space_xyz.xy+vec2(shadow_map_step,-shadow_map_step)).r;
	test += (t.x)*(1-t.y)*clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0);
	return test;
}

float shadow_pcf_gaussian(vec3 light_space_xyz)
{
	float shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy).r;

//	float radius = 0.5 + 30.5 * abs((light_space_xyz_ecs.z - light_space_xyz_sample_ecs.z) / light_space_xyz_ecs.z);
	//radius = 1 + light_size * ((light_space_xyz.z - shadow_map_z)/light_space_xyz.z);

	float radius = light_size;
	float sum_radius = 0.0;
	
	vec4 light_space_xyz_ecs = inverse(uniform_light_projection) * vec4(2.0 * light_space_xyz - 1.0, 1.0);
	light_space_xyz_ecs /= light_space_xyz_ecs.w;

	for (int i = 0; i < 16; i++)
	{
		vec2 _kernel = radius * vec2(uniform_samples[i].xy);
		vec2 texel_offset = _kernel/float(shadow_map_resolution);
		float shadow_map_z = texture(sampler_shadow_map, light_space_xyz.xy + texel_offset).r;
		vec4 light_space_xyz_sample_ecs = inverse(uniform_light_projection) * vec4(2.0 * light_space_xyz.xy - 1.0, 2.0 * shadow_map_z - 1.0, 1.0);
		light_space_xyz_sample_ecs /= light_space_xyz_sample_ecs.w;

		sum_radius += 10 * abs((light_space_xyz_ecs.z - light_space_xyz_sample_ecs.z) / light_space_xyz_ecs.z);
	}
	sum_radius /= 16.0;

	sum_radius *= radius;

	radius = max(sum_radius, 1.0);

	//return radius / 50.0;

	vec2 offset;
	int i = 0;

	vec2 offset_jittering = 0.4 * texture2D(sampler_noise, 220 * (light_space_xyz.xy-vec2(0.5,0.5))).xy;
	float costheta = cos(offset_jittering.x * 6.28);
	float sintheta = sin(offset_jittering.x * 6.28);
	mat2 rotX = mat2(vec2(costheta, sintheta), vec2(-sintheta, costheta));
		
	float weight_total = 0.0;

	float res = 0;//clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);	
	
	for (i = 0; i < 16; i++)
	{
		vec2 _kernel = vec2(uniform_samples[i].xy);
		_kernel = rotX * _kernel;
		//float dist = length(_kernel);
		float weight = 1;//exp(dist * dist);
		offset = 1 * radius * (_kernel + offset_jittering);
		vec2 texel_offset = offset/float(shadow_map_resolution);
		float shadow_map_z = texture2D(sampler_shadow_map, light_space_xyz.xy + texel_offset).r;
		// constant depth bias
		//res += (clamp(-sign(light_space_xyz.z - uniform_constant_bias - shadow_map_z),0.0,1.0) * weight);
		// slope _bias
		float slope_bias = abs((texel_offset.x * d_anal_z_to_du_dv.x)) + abs((texel_offset.y * d_anal_z_to_du_dv.y)) + uniform_constant_bias;
		res += (clamp(-sign(light_space_xyz.z - slope_bias - shadow_map_z),0.0,1.0) * weight);
		weight_total += weight;
	}
	res /= weight_total;

	if (res > 15/16.0) res = 1.0;

	return res;
	
	// + shaded -> 0.0 
	// - lit -> 1.0
	return 1.0;
}

float shadow(vec3 pecs)
{
	vec4 pwcs = uniform_view_inverse * vec4(pecs, 1);
	vec4 plcs = uniform_light_projection * uniform_light_view * pwcs;
	plcs /= plcs.w;
	plcs.xy = (plcs.xy + 1) * 0.5;
	
	// check that we are inside light clipping frustum
	//if (plcs.x < 0.0) return 0.0; if (plcs.y < 0.0) return 0.0; if (plcs.x > 1.0) return 0.0; if (plcs.y > 1.0) return 0.0;
	if ((clamp(plcs.xy, vec2(0,0), vec2(1,1)) - plcs.xy) != vec2(0,0)) return 0.0;

	// set scale of shadow map value to [-1,1] or
	// set scale of light space z vaule to [0, 1]
	plcs.z = (plcs.z + 1) * 0.5;

	initSlopeBias(plcs.xyz);

	float shadowFactor = 1;
	
	//shadowFactor = shadow_nearest(plcs.xyz);

	//shadowFactor = shadow_pcf_3x3(plcs.xyz);
	
	//shadowFactor = shadow_pcf_2x2_bilinear_interpolation(plcs.xyz);
	
	shadowFactor = shadow_pcf_gaussian(plcs.xyz);

	return shadowFactor;
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
	float surface_smoothness = specular_exp.a * 127.0 + 1.0;

	vec4 occlusion = texture2D(sampler_occlusion, TexCoord.xy);
	vec3 normal_bent_unclamped = normal_unpack_xy(occlusion.rgb);

	vec3 pecs = reconstruct_position_from_depth();

	vec3 light_position_ecs = (uniform_view * vec4(light_position, 1)).xyz;
	vec3 vertex_to_light_direction_ecs = light_position_ecs - pecs.xyz;
	float dist2 = dot(vertex_to_light_direction_ecs,vertex_to_light_direction_ecs);

	// normalize vertex to light direction vector
	vertex_to_light_direction_ecs = normalize(vertex_to_light_direction_ecs);

	// check spotlight cutoff between light-to-vertex and spotlight direction
	float spoteffect = check_spotlight(vertex_to_light_direction_ecs);	
	
	float ndotl = directional_lighting_color_phong(normal_unclamped.xyz, vertex_to_light_direction_ecs.xyz);
	//float ndotl = directional_lighting_color_half_lambert(normal_unclamped.xyz, vertex_to_light_direction_ecs.xyz);
	
	//float ndotl_occ = directional_lighting_color_phong(normal_bent_unclamped.xyz, vertex_to_light_direction_ecs.xyz);
	//float ndotl = directional_lighting_color_half_lambert(normal_unclamped.xyz, light_direction_ecs.xyz);
	//ndotl_occ = clamp(ndotl_occ, 0.0, 1.0);

	//ndotl_occ = pow(ndotl_occ, 2 * (1-occlusion.a));

	vec3 vertex_to_view_direction = -normalize(pecs.xyz);
	//vec3 specular = phong_specular(vertex_to_light_direction_ecs.xyz, vertex_to_view_direction, normal_unclamped, surface_smoothness) * ks;
	vec3 specular = phong_blinn_specular(vertex_to_light_direction_ecs.xyz, vertex_to_view_direction, normal_unclamped, surface_smoothness) * ks;

	// GP
	ndotl = max(ndotl,0);
	vec3 irradiance = light_color.rgb * ndotl / ( 3.14159 *( dist2 /*- light_size*light_size*/ ) );
	
	vec3 diff_brdf = (1 - ks) * kd.rgb / 3.1459;
	vec3 dirColor = (diff_brdf + specular) *irradiance * spoteffect;

	//vec3 dirColor = (specular) *irradiance * spoteffect;

	float shadowFactor = 1; 
	if (shadows_enabled) shadowFactor = shadow(pecs);

	dirColor *= shadowFactor;
	dirColor *= occlusion.a * occlusion.a;

	//dirColor = vec3(0.5*ndotl+0.5,0.5*ndotl+0.5,0.5*ndotl+0.5);
	out_color = vec4(dirColor,1);
}
