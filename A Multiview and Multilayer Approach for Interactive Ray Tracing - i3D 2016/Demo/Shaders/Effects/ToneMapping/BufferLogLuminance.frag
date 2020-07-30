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
layout(location = 0) out float out_color;
in vec2 TexCoord;
uniform sampler2D sampler_input;
uniform sampler2DArray sampler_input_array;
uniform int uniform_layer;

#include "utilities.h"

void main(void)
{
	vec4 color1 = texture(sampler_input, TexCoord.xy);
	vec4 color2 = texture(sampler_input_array, vec3(TexCoord.xy, uniform_layer));
	vec4 color = vec4(0);
	
	if (uniform_layer < 0) color = color1;
	else color = color2;

	float L = max(0.001, luminance(color.rgb));
	out_color = log(L);	
}
