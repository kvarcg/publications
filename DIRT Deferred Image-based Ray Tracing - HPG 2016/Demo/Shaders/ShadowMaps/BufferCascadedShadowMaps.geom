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

layout(triangles) in;
layout (triangle_strip, max_vertices=12) out;

uniform mat4 uniform_light_projection[4];
uniform int uniform_light_projection_number;

in vec3 v_Necs[3];
in vec3 v_Tecs[3];
in vec3 v_Becs[3];
in vec2 v_texcoord0[3];
in vec2 v_texcoord1[3];
in vec4 v_color[3];

out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec2 TexCoord[2];
out vec4 vertex_color;

 void main()
{
	for (int i = 0; i < uniform_light_projection_number; ++i)
	{
		gl_Layer = i;
		for(int j = 0; j < gl_in.length(); j++)
		{
			Necs = v_Necs[j];
			Tecs = v_Tecs[j];
			Becs = v_Becs[j];
			vertex_color  = v_color[j];
			TexCoord[0] = v_texcoord0[j];
			TexCoord[1] = v_texcoord1[j];

			// copy attributes
			gl_Position = uniform_light_projection[i] * gl_in[j].gl_Position;
	
			// done with the vertex
			EmitVertex();
		}
		EndPrimitive();
	}
}
