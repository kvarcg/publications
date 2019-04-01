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
uniform vec3 uniform_background_color;

layout(location = 0) out vec4 out_albedo;
layout(location = 1) out vec4 out_normal_emission;
layout(location = 2) out vec4 out_specular;
layout(location = 3) out vec4 out_effects;

void main(void)
{
	out_albedo = vec4(uniform_background_color, 1);
	out_normal_emission = vec4(0.0, 0.0, 0.0, 0.0);
	out_specular = vec4(0.0, 0.0, 0.0, 0.0);
	out_effects = vec4(0.0, 0.0, 0.0, 0.0);
}
