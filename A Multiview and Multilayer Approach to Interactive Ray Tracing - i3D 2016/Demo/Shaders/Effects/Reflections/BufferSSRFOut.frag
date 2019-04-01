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

uniform sampler2D sampler_depth;
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_normal;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_noise;
uniform sampler2D sampler_lighting;
uniform sampler2D sampler_glow;

uniform mat4 uniform_view;
uniform mat4 uniform_proj;

#include "normal_compression.h"

void main(void)
{
	vec4 reflection = texture(sampler_glow, TexCoord.xy);
	
	vec4 current_lighting = texture(sampler_lighting, TexCoord.xy);

	vec4 final_color = reflection + current_lighting;

	out_color = vec4(final_color.xyz, 1);
}
