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
layout(location = 0) out float out_color;
in vec2 TexCoord;
uniform sampler2D sampler_input;

void main(void)
{
	vec4 color = texture2D(sampler_input, TexCoord.xy);
	
	float L = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
	
	out_color = log(L + 0.001);	
}
