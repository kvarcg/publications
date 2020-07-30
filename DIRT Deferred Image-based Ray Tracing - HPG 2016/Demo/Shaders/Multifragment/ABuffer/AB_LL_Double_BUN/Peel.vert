// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Double linked-list with buckets vertex implementation of Peel stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;


uniform mat4 uniform_mv;
uniform mat4 uniform_mvp;

out vec2 TexCoord;
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4 vertex_color;
out float pecsZ;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   TexCoord = vec2(texcoord0.x,texcoord0.y);

   Necs = normalize ((uniform_mv * vec4(normal,0)).xyz );
   Tecs = normalize ((uniform_mv * vec4(tangent,0)).xyz );
   Becs = cross(Necs,Tecs);

   vertex_color = color;
   pecsZ = (uniform_mv * vec4(position, 1)).z;
}
