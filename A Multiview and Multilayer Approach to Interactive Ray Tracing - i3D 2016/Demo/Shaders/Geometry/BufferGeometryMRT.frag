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
//layout(early_fragment_tests) in;
// Channels:
// 0: R,    G,    B,		1-Ke
// 1: Nx,   Ny
// 2: reflectance, gloss, metallic, unused 
// 3: v_x,  v_y,  Unused,   Unused
// 4: ItemID, Unused
//
//
layout(location = 0) out vec4 out_albedo;
layout(location = 1) out vec2 out_normal;
layout(location = 2) out vec4 out_specular;
layout(location = 3) out vec4 out_effects;
layout(location = 4) out uvec2 out_itemID;

in vec3 Necs;
in vec3 Tecs;
in vec3 Becs;
in vec4[2] TexCoord;
in vec4 curpos;
in vec4 prev;
in vec4 vertex_color;
flat in uint itemID;

uniform sampler2D sampler_color;
uniform sampler2D sampler_noise;
uniform sampler2D sampler_bump;
uniform sampler2D sampler_emission;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_opacity;

uniform uint uniform_texture_mask;
uniform vec4 uniform_material_color;
uniform float uniform_reflectance;
uniform vec3 uniform_emission;
uniform float uniform_gloss;
uniform float uniform_metallic;

uniform int uniform_lighting_buffer_enabled;

#include "normal_compression.h"

void main(void)
{
	uint hasalb  = (uniform_texture_mask & 0x01u) >> 0u;
	uint hasbump = (uniform_texture_mask & 0x02u) >> 1u;
	uint hasspec = (uniform_texture_mask & 0x04u) >> 2u;
	uint hasemis = (uniform_texture_mask & 0x08u) >> 3u;
	uint hasop	 = (uniform_texture_mask & 0x10u) >> 4u;

	vec4 tex_color = texture(sampler_color, TexCoord[0].st);
	float em_color = texture(sampler_emission, TexCoord[0].st).r;
	vec4 nmap = texture(sampler_bump, TexCoord[0].st);
	float heigh_prev_U = textureOffset(sampler_bump, TexCoord[0].st,ivec2(-1,0)).r;
	float heigh_prev_V = textureOffset(sampler_bump, TexCoord[0].st,ivec2(0,-1)).r;
	vec4 spec_color = texture(sampler_specular, TexCoord[0].st);	
		 
	vec4 tex_comb = uniform_material_color * vertex_color;
	if (hasalb > 0u) tex_comb = tex_color;

	if (uniform_lighting_buffer_enabled > 0) tex_comb.rgb = vec3(1);
	
	float opacity_map = (hasop > 0u) ? texture(sampler_opacity, TexCoord[0].st).x : 0.0;

	if (tex_color.a < 0.5 || opacity_map == 1.0) discard;

	out_albedo.rgb = tex_comb.rgb;
	
	// emission
	float em = (uniform_emission.x+uniform_emission.y+uniform_emission.z)/3.0;
	if (hasemis > 0u)
		em *= em_color;

	if (em > 0) em *= 10;
	out_albedo.a = 1.0 - em;

	// normal
	vec3 newN = Necs;
	if (hasbump > 0u)
	{
		newN+= -2.0*(Tecs*(nmap.r-heigh_prev_U) + Becs*(nmap.r-heigh_prev_V));
	}
	newN = normalize(newN);
	out_normal.xy = normal_encode_spheremap1(newN);

	// specular gloss
	vec4 spec_coefs = vec4(uniform_reflectance, uniform_gloss, uniform_metallic, 1.0);
	if (hasspec > 0u)
	{
		spec_coefs = spec_color;
	}
	out_specular = spec_coefs;
	// pass a fixed reflectivity parameter for VRMW to allow compatibility with standard obj material format
	//out_specular = vec4(0.1,uniform_gloss,uniform_metallic, 1);

	// velocity
	vec3 velocity = vec3((curpos.xyz/curpos.w) - (prev.xyz/prev.w));
	out_effects.xy = velocity.xy*2.0+0.5;

	out_effects.zw = vec2(0,1);

	// item buffer
	out_itemID.x = itemID;
	// TODO: this is test value
	out_itemID.y = 0u;
}
