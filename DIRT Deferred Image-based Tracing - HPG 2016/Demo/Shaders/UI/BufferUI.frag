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
layout(location = 1) out uvec2 out_itemID;

uniform uint uniform_itemID;
uniform sampler2D sampler_color;

uniform uint uniform_texture_mask;
uniform vec4 uniform_material_color;
uniform int uniform_lighting_buffer_enabled;

in vec2 TexCoord;
in vec3 vertex_position_ecs;
in vec4 vertex_color;
in vec3 vertex_normal_ecs;

#include "microfacet_direct_lighting.h"

void main(void)
{
	uint hasalb  = (uniform_texture_mask & 0x01u) >> 0u;

	vec4 tex_color = texture(sampler_color, TexCoord.st);

	if (hasalb == 0u)
		tex_color = vec4(1);
		 
	vec4 tex_comb = uniform_material_color * vertex_color * tex_color;

	if (uniform_lighting_buffer_enabled > 0)
		tex_comb.rgb = vec3(1);
	
	if (tex_comb.a < 0.5)
		discard;

	vec3 normal_ecs = normalize(vertex_normal_ecs);
	
	vec3 vertex_to_light_direction_ecs = -vertex_position_ecs.xyz;

	// normalize vertex to light direction vector
	vertex_to_light_direction_ecs = normalize(vertex_to_light_direction_ecs);

	float ndotl = NdotL_enhanced(vertex_to_light_direction_ecs, normal_ecs);

	out_color.rgb = tex_comb.rgb * ndotl;
	out_color.a = 1.0;
	
	// item buffer
	out_itemID.x = uniform_itemID;
	// TODO: this is test value
	out_itemID.y = 11u;
}
