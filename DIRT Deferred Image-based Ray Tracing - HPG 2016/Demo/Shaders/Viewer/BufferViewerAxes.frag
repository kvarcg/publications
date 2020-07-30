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

uniform vec4 uniform_material_color;

in vec3 vertex_position_ecs;
in vec4 vertex_color;
in vec3 vertex_normal_ecs;

#include "microfacet_direct_lighting.h"

void main(void)
{
	vec4 tex_comb = uniform_material_color * vertex_color;

	if (tex_comb.a < 0.5)
		discard;

	vec3 normal_ecs = normalize(vertex_normal_ecs);
	
	vec3 vertex_to_light_direction_ecs = vec3(0,0,-1) - vertex_position_ecs.xyz;

	// normalize vertex to light direction vector
	vertex_to_light_direction_ecs = normalize(vertex_to_light_direction_ecs);

	float ndotl = NdotL_enhanced(vertex_to_light_direction_ecs, normal_ecs);

	out_color.rgb = tex_comb.rgb * ndotl;
	out_color.a = 1.0;
}
