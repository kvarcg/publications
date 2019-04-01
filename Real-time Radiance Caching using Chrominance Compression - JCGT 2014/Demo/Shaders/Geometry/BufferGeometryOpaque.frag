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
//layout(early_fragment_tests) in;
// Channels:
// 0: R,    G,    B,     flags
// 1: Nx,   Ny,   Nz,    1-Ke
// 2: Ks_r, Ks_g, Ks_b,  Ns
// 3: v_x,  v_y,  Kr,    anisotropy
//
// flags:      May in the future define material modifiers
// anisotropy: (0.5: no anisotropy, 0.0: full tangential aniso, 1.0: full bitangential anis),    
// Kr:         mirror reflection coef. It is modulated per color channel by Ks.
//
layout(location = 0) out vec4 out_albedo;
layout(location = 1) out vec2 out_normal;
layout(location = 2) out vec4 out_specular;
layout(location = 3) out vec4 out_effects;

in vec3 Necs;
in vec3 Tecs;
in vec3 Becs;
in vec4[2] TexCoord;
in vec4 curpos;
in vec4 prev;
in vec4 vertex_color;

uniform sampler2D sampler_color;
uniform sampler2D sampler_noise;
uniform sampler2D sampler_bump;
uniform sampler2D sampler_emission;
uniform sampler2D sampler_specular;

uniform uint uniform_texture_mask;
uniform vec4 uniform_material_color;
uniform vec3 uniform_specular;
uniform vec3 uniform_emission;
uniform float uniform_spec_exp;

uniform int uniform_shadow_receiver;
uniform int uniform_lighting_receiver;

uniform int lighting_buffer;

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

void main(void)
{
	uint hasalb  = (uniform_texture_mask & 0x01u) >> 0u;
	uint hasbump = (uniform_texture_mask & 0x02u) >> 1u;
	uint hasspec = (uniform_texture_mask & 0x04u) >> 2u;
	uint hasemis = (uniform_texture_mask & 0x08u) >> 3u;

	vec4 tex_color = vec4(1);

	if (hasalb > 0u)
		tex_color = texture(sampler_color, TexCoord[0].st);
		 
	vec4 tex_comb = uniform_material_color * vertex_color * tex_color;

	if (lighting_buffer > 0)
		tex_comb.rgb = vec3(1);
	
	if (tex_comb.a < 0.5)
		discard;

	out_albedo.rgb = tex_comb.rgb;
	
	// emission
	float em = (uniform_emission.x+uniform_emission.y+uniform_emission.z)/3.0;
	if (hasemis > 0u)
	{
		em += texture(sampler_emission, TexCoord[0].st).r;
	}
	out_albedo.a = 1.0 - em;

	// normal
	vec3 newN = Necs;
	if (hasbump > 0u)
	{
		vec4 nmap = texture(sampler_bump, TexCoord[0].st);
		float heigh_prev_U = textureOffset(sampler_bump, TexCoord[0].st,ivec2(-1,0)).r;
		float heigh_prev_V = textureOffset(sampler_bump, TexCoord[0].st,ivec2(0,-1)).r;
		newN+= -2.0*(Tecs*(nmap.r-heigh_prev_U) + Becs*(nmap.r-heigh_prev_V));
	}
	newN = normalize(newN);
	out_normal.xy = normal_encode_spheremap1(newN);

	// specular gloss
	vec4 spec_coefs = vec4(uniform_specular, uniform_spec_exp);
	if (hasspec > 0u)
	{
		spec_coefs = texture(sampler_specular, TexCoord[0].st);
	}
	out_specular = spec_coefs;

	// velocity
	vec3 velocity = vec3((curpos.xyz/curpos.w) - (prev.xyz/prev.w));
	out_effects.xy = velocity.xy*2.0+0.5;

	out_effects.zw = vec2(0,1);
	//if (uniform_shadow_receiver > 0)

}
