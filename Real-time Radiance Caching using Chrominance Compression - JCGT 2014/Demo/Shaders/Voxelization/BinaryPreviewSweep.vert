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
//#extension GL_EXT_gpu_shader4 : enable
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;

uniform mat4 uniform_view_proj;
uniform mat4 uniform_model;

out vec4 p_wcs;

void main(void)
{ 
	p_wcs = uniform_model * vec4(position,1);
    gl_Position = uniform_view_proj * p_wcs;
}
