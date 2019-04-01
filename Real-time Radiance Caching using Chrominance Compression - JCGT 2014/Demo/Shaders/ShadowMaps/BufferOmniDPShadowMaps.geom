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
layout (triangle_strip, max_vertices=18) out;

uniform mat4 uniform_light_view[6];
uniform mat4 uniform_light_projection;
uniform mat4 uniform_T0;
uniform mat4 uniform_T1;
uniform float uniform_near;
uniform float uniform_far;

in vec4 vertex_position[3];
in vec3 vertex_normal[3];
in vec3 vertex_tangent[3];
in vec2 vertex_texcoord0[3];
in vec2 vertex_texcoord1[3];
in vec4 vertex_color[3];


out vec4 pwcs;
out vec4 pecs;
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4[2] TexCoord;
out vec4 color;

 void main()
{
	for (int face = 0; face < 2; ++face)
	{
		gl_Layer = face;
		for(int j = 0; j < gl_in.length(); j++)
		{
			Necs = normalize((uniform_light_view[face] * vec4(vertex_normal[j],0)).xyz);
			Tecs = normalize((uniform_light_view[face] * vec4(vertex_tangent[j],0)).xyz);
			Becs = cross(Necs,Tecs);

			pwcs = gl_in[j].gl_Position;
			pecs = uniform_light_view[face] * pwcs;
			TexCoord[0] = uniform_T0*vec4(vertex_texcoord0[j].x,vertex_texcoord0[j].y,0,1);
			TexCoord[1] = uniform_T1*vec4(vertex_texcoord1[j].x,vertex_texcoord1[j].y,0,1);

			color = vertex_color[j];

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
