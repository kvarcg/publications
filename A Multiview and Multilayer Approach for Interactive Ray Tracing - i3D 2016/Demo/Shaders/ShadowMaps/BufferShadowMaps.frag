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
layout(location = 0) out vec2 out_normal;
layout(location = 1) out vec4 out_lighting;
in vec4 pecs;
in vec3 Necs;
in vec3 Tecs;
in vec3 Becs;
in vec2[2] TexCoord;
in vec4 vertex_color;

uniform sampler2D sampler_albedo;
uniform sampler2D sampler_bump;
uniform sampler2D sampler_opacity;

uniform vec4 uniform_material_color;
uniform uint uniform_texture_mask;
uniform mat4 uniform_light_view;
uniform vec3 uniform_light_color;
uniform vec3 uniform_light_direction;
uniform int uniform_light_is_conical;
uniform float uniform_light_cosine_umbra;
uniform float uniform_light_cosine_penumbra;
uniform float uniform_spotlight_exponent;
uniform int uniform_resolution;
uniform mat4 uniform_light_projection;

#include "random_number.h"
#include "normal_compression.h"
#include "spotlight.h"

void main(void)
{
	uint hastex  = (uniform_texture_mask & 0x01u) >> 0u;
	uint hasbump = (uniform_texture_mask & 0x02u) >> 1u;
	uint hasop	=  (uniform_texture_mask & 0x10u) >> 4u;

	vec4 tex_color = vec4(1,1,1,1);
	if (hastex > 0u)
		tex_color = texture(sampler_albedo, TexCoord[0].st);

	float opacity_map = (hasop > 0u) ? texture(sampler_opacity, TexCoord[0].st).x : 0.0;
	vec2 seed = getSamplingSeed(TexCoord[0]);
	float rand = rand1n(seed);
	if (tex_color.a < rand || opacity_map == 1.0) discard;

	// if RSM is disabled, this value is set to -1 in order to skip everything
	if (uniform_resolution == -1) return;

	vec4 kd = uniform_material_color * vertex_color * tex_color;
	
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
	out_normal = normal_encode_spheremap1(newN);
	
	// calculate flux 
	vec3 vertex_to_light_direction_ecs = -normalize(pecs.xyz);
		
	// check spotlight cutoff between light-to-vertex and spotlight direction
	float spoteffect = check_spotlight(uniform_light_view, vertex_to_light_direction_ecs);
		
	float res = uniform_resolution;

	vec3 radiosity = kd.rgb * uniform_light_color.rgb; 
	out_lighting = vec4(radiosity * spoteffect, 1.0);
}
