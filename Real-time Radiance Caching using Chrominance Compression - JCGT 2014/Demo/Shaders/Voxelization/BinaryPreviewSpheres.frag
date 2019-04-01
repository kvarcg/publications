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
#extension GL_EXT_gpu_shader4 : enable

layout(location = 0) out vec4 out_color;

in vec4 p_wcs;
flat in int ok;

void main(void)
{
	if(ok == 0) 
		out_color = vec4(0,0,1,1);
	else
		discard;//out_color = vec4(1,0,0,1);

}
