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

layout(triangles) in;
layout (triangle_strip, max_vertices=15) out;

uniform mat4 uniform_light_projection[8];
uniform int uniform_light_projection_number;

 void main()
{
	for (int i = 0; i < uniform_light_projection_number; ++i)
	{
		gl_Layer = i;
		for(int j = 0; j < gl_in.length(); j++)
		{
			// copy attributes
			gl_Position = uniform_light_projection[i] * gl_in[j].gl_Position;
	
			// done with the vertex
			EmitVertex();
		}
	EndPrimitive();
  }
}
