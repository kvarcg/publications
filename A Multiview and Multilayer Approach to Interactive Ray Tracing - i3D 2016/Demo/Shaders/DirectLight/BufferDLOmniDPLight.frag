//----------------------------------------------------//
//                                                    //
// This is a free rendering engine. The library and   //
// the source code are free. If you use this code as  //
// is or any part of it in any kind of project or     //
// product, please acknowledge the source and its	  //
// author.											  //
//                                                    //
// For manuals, help and instructions, please visit:  //
// http://graphics.cs.aueb.gr/graphics/               //
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
uniform sampler2DArray sampler_shadow_map;
uniform vec3 uniform_light_color;
uniform vec3 uniform_light_position;
uniform float uniform_light_size;
uniform float uniform_shadow_map_resolution;
uniform bool uniform_shadows_enabled;
uniform vec2 uniform_samples[16];
uniform float uniform_constant_bias;

uniform mat4 uniform_view;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_light_view[2];
uniform mat4 uniform_light_projection;
uniform float uniform_light_near_range;
uniform float uniform_light_far_range;

#include "normal_compression.h"
#include "depth_reconstruction.h"
#include "microfacet_direct_lighting.h"

vec2 d_anal_z_to_du_dv;
// Initializes the parameters for the adaptive depth bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
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
	ddist_duv.x = d_v_to_dy * d_anal_z_to_dx; // invJtrans[0][0] * ddist_dx
	ddist_duv.x -= d_v_to_dx * d_anal_z_to_dy; // invJtrans[0][1] * ddist_dy
											   //Bottom row of 2x2
	ddist_duv.y = d_u_to_dx * d_anal_z_to_dx;   // invJtrans[1][1] * ddist_dy
	ddist_duv.y -= d_u_to_dy * d_anal_z_to_dy;  // invJtrans[1][0] * ddist_dx
	ddist_duv *= invDet;

	// derivative of distance to light source with respect to texture coordinates
	d_anal_z_to_du_dv = ddist_duv;
}

// Traditional shadow mapping (1 sample per pixel) with a constant bias
// Parameters:
// plcs: the position in [0-1) range in light post-projective coordinates
// Returns the shadow factor for the current point
float shadow_nearest(vec3 pwcs)
{
	vec3 p_to_light = uniform_light_position - pwcs;
	float plcs_length = length(p_to_light);
	vec3 plcs_direction = p_to_light / plcs_length;

	float shadow_map_z;
	if( p_to_light.z > 0.0) 
	{
		vec4 pecs = uniform_light_view[0] * vec4(pwcs,1);
		plcs_length = length(pecs.xyz);
		plcs_direction = pecs.xyz;
		plcs_direction = plcs_direction / plcs_length;
		// back side
		plcs_direction.x /= plcs_direction.z + 1.0;
		plcs_direction.y /= plcs_direction.z + 1.0;
		plcs_direction.z = (plcs_length - uniform_light_near_range) / (uniform_light_far_range - uniform_light_near_range);
		plcs_direction.x = 0.5 * plcs_direction.x + 0.5;
		plcs_direction.y = 0.5 * plcs_direction.y + 0.5;
		plcs_direction.z = 0.5 * plcs_direction.z + 0.5;

		// sample shadow map
		shadow_map_z = texture(sampler_shadow_map, vec3(plcs_direction.xy, 0)).r;
	}
	else
	{
		vec4 pecs = uniform_light_view[1] * vec4(pwcs,1);
		plcs_length = length(pecs.xyz);
		plcs_direction = pecs.xyz;
		plcs_direction = plcs_direction / plcs_length;
		// front side
		plcs_direction.x /= plcs_direction.z + 1.0;
		plcs_direction.y /= plcs_direction.z + 1.0;
		plcs_direction.z = (plcs_length - uniform_light_near_range) / (uniform_light_far_range - uniform_light_near_range);
		plcs_direction.x = 0.5 * plcs_direction.x + 0.5;
		plcs_direction.y = 0.5 * plcs_direction.y + 0.5;
		plcs_direction.z = 0.5 * plcs_direction.z + 0.5;

		// sample shadow map
		shadow_map_z = texture(sampler_shadow_map, vec3(plcs_direction.xy, 1)).r;
	}

	// + shaded -> 0.0 
	// - lit -> 1.0
	return clamp(-sign((plcs_direction.z - uniform_constant_bias) - shadow_map_z), 0.0, 1.0);
}

float shadow_pcf_gaussian(vec3 pwcs)
{
	vec3 p_to_light = uniform_light_position - pwcs;
	float plcs_length = length(p_to_light);
	vec3 plcs_direction = p_to_light / plcs_length;
	int face = (p_to_light.z > 0.0)? 0 : 1;

	vec4 pecs = uniform_light_view[face] * vec4(pwcs,1);
	plcs_length = length(pecs.xyz);
	plcs_direction = pecs.xyz;
	plcs_direction = plcs_direction / plcs_length;
	// back side
	plcs_direction.x /= plcs_direction.z + 1.0;
	plcs_direction.y /= plcs_direction.z + 1.0;
	plcs_direction.z = (plcs_length - uniform_light_near_range) / (uniform_light_far_range - uniform_light_near_range);
	plcs_direction.xyz = 0.5 * plcs_direction.xyz + 0.5;

	// sample shadow map
	float shadow_map_z = texture(sampler_shadow_map, vec3(plcs_direction.xy, face)).r;
	
//	float radius = 0.5 + 30.5 * abs((light_space_xyz_ecs.z - light_space_xyz_sample_ecs.z) / light_space_xyz_ecs.z);
	//radius = 1 + uniform_light_size * ((light_space_xyz.z - shadow_map_z)/light_space_xyz.z);

	float radius = uniform_light_size;
	float sum_radius = 0.0;
	
	for (int i = 0; i < 16; i++)
	{
		vec2 _kernel = radius * vec2(uniform_samples[i].xy);
		vec2 texel_offset = _kernel/float(uniform_shadow_map_resolution);
		float shadow_map_z = texture(sampler_shadow_map, vec3(plcs_direction.xy + texel_offset, face)).r;
		// decode Z value
		shadow_map_z = 2.0 * shadow_map_z - 1.0;
		shadow_map_z = shadow_map_z * (uniform_light_far_range - uniform_light_near_range) + uniform_light_near_range;

		sum_radius += 10 * abs((plcs_length - shadow_map_z) / plcs_length);
	}
	sum_radius /= 16.0;

	sum_radius *= uniform_light_size;

	radius = max(sum_radius, 1.0);

	//return radius / 50.0;

	vec2 offset;
	int i = 0;

	vec2 offset_jittering = 0.4 * texture(sampler_noise, 220 * (plcs_direction.xy-vec2(0.5,0.5))).xy;
	float costheta = cos(offset_jittering.x * 6.28);
	float sintheta = sin(offset_jittering.x * 6.28);
	mat2 rotX = mat2(vec2(costheta, sintheta), vec2(-sintheta, costheta));
		
	float weight_total = 0.0;

	float res = 0;//clamp(-sign(plcs_direction.z - uniform_constant_bias - shadow_map_z), 0.0, 1.0);	
	
	for (i = 0; i < 16; i++)
	{
		vec2 _kernel = vec2(uniform_samples[i].xy);
		_kernel = rotX * _kernel;
		//float dist = length(_kernel);
		float weight = 1;//exp(dist * dist);
		offset = 1 * radius * (_kernel + offset_jittering);
		vec2 texel_offset = offset/float(uniform_shadow_map_resolution);
		float shadow_map_z = texture(sampler_shadow_map, vec3(plcs_direction.xy + texel_offset, face)).r;
		// constant depth bias
		//res += (clamp(-sign(plcs_direction.z - uniform_constant_bias - shadow_map_z),0.0,1.0) * weight);
		// slope _bias
		float slope_bias = abs((texel_offset.x * d_anal_z_to_du_dv.x)) + abs((texel_offset.y * d_anal_z_to_du_dv.y)) + uniform_constant_bias;
		res += (clamp(-sign(plcs_direction.z - slope_bias - shadow_map_z),0.0,1.0) * weight);
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
	vec3 plcs = uniform_light_position - pwcs.xyz;
	float plcs_length = length(plcs);
	plcs = plcs / plcs_length;
	plcs.x /= plcs.z + 1.0;
	plcs.y /= plcs.z + 1.0;
	plcs.z = (plcs_length - uniform_light_near_range) / (uniform_light_far_range - uniform_light_near_range);

	// set scale of shadow map value to [-1,1] or
	// set scale of light space z vaule to [0, 1]
	plcs.xyz = (plcs.xyz + 1) * 0.5;
	
	initSlopeBias(plcs.xyz);

	float shadowFactor = 1;
	
	shadowFactor = shadow_nearest(pwcs.xyz);

	//shadowFactor = shadow_pcf_3x3(plcs.xyz);
	
	//shadowFactor = shadow_pcf_2x2_bilinear_interpolation(plcs.xyz);
	
	//shadowFactor = shadow_pcf_gaussian(plcs.xyz);

	return shadowFactor;
}

void main(void)
{
	vec4 kd = texture(sampler_albedo, TexCoord.xy);
	vec2 normal_packed = texture(sampler_normal, TexCoord.xy).xy;
	vec3 normal_unclamped = normal_decode_spheremap1(normal_packed.rg);

	vec4 specular_params = texture(sampler_specular, TexCoord.xy);

	vec4 occlusion = texture(sampler_occlusion, TexCoord.xy);
	//vec3 normal_bent_unclamped = normal_unpack_xy(occlusion.rgb);

	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, texture(sampler_depth, TexCoord.xy).r);

	vec3 light_position_ecs = (uniform_view * vec4(uniform_light_position, 1)).xyz;
	vec3 vertex_to_light_direction_ecs = light_position_ecs - pecs.xyz;
	float dist2 = dot(vertex_to_light_direction_ecs,vertex_to_light_direction_ecs);

	// normalize vertex to light direction vector
	vertex_to_light_direction_ecs = normalize(vertex_to_light_direction_ecs);

	vec3 vertex_to_view_direction = -normalize(pecs.xyz);
	vec3 dirColor = MicrofacetBRDF(vertex_to_view_direction, vertex_to_light_direction_ecs.xyz, normal_unclamped.xyz, kd.rgb, specular_params.xyz) * uniform_light_color.rgb /dist2;

	float shadowFactor = 1; 
	if (uniform_shadows_enabled) shadowFactor = shadow(pecs);
	dirColor *= shadowFactor;
	dirColor *= occlusion.a * occlusion.a;

	out_color = vec4(dirColor,1);
}
