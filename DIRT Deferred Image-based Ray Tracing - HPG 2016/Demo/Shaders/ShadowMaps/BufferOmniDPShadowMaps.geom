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
layout (triangle_strip, max_vertices=18) out;

uniform mat4 uniform_light_normal_matrix[2];
uniform mat4 uniform_light_view[2];
uniform mat4 uniform_light_projection;
uniform float uniform_near;
uniform float uniform_far;

in vec4 v_position[3];
in vec3 v_normal[3];
in vec3 v_tangent[3];
in vec3 v_bitangent[3];
in vec2 v_texcoord0[3];
in vec2 v_texcoord1[3];
in vec4 v_color[3];

out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec2[2] TexCoord;
out vec4 vertex_color;

 void main()
{
	for (int face = 0; face < 2; ++face)
	{
		gl_Layer = face;

		for(int j = 0; j < gl_in.length(); j++)
		{
			Necs = normalize((uniform_light_normal_matrix[face] * vec4(v_normal[j],0)).xyz);
			Tecs = normalize((uniform_light_normal_matrix[face] * vec4(v_tangent[j],0)).xyz);
			Becs = normalize((uniform_light_normal_matrix[face] * vec4(v_bitangent[j],0)).xyz);

			TexCoord[0] = v_texcoord0[j];
			TexCoord[1] = v_texcoord1[j];

			vertex_color = v_color[j];

			vec4 pecs = uniform_light_view[face] * gl_in[j].gl_Position;
			vec4 out_position = pecs;
			float fLength = length(out_position.xyz);
			out_position = out_position / fLength;
			out_position.x /= -out_position.z + 1.0;
			out_position.y /= -out_position.z + 1.0;
			float sgn = sign(out_position.z);
			out_position.z = (fLength - uniform_near) / (uniform_far - uniform_near);
			out_position.w = -sgn;

			gl_Position = out_position;
	
			// done with the vertex
			EmitVertex();
		}
	EndPrimitive();
  }
}
