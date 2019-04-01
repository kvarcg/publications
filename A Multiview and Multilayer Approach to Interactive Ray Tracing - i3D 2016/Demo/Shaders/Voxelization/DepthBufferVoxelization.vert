// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the vertex implementation for the generation of the depth occupancy volume

#version 330 core
//#extension GL_EXT_gpu_shader4 : enable
layout(location = 0) in vec2 unused_number;

uniform sampler2D sampler_depth;
uniform mat4 uniform_mvp_inverse;
uniform vec3 uniform_bbox_min;
uniform vec3 uniform_bbox_max;
uniform int uniform_step_size;

void main(void)
{   
   int index = gl_VertexID * uniform_step_size; //int(gl_Vertex.x);
   // get the size of the texture
   ivec2 uniform_tex_size = textureSize(sampler_depth, 0);
   // calculate the texture coordinates
   ivec2 texCoord = ivec2((index + (uniform_step_size / 2)) % uniform_tex_size.x, (index + uniform_step_size / 2) / uniform_tex_size.x);

   // sample the depth buffer
   float depth = texelFetch(sampler_depth,texCoord.xy,0).r;
   vec2 normalized_TexCoord = vec2(texCoord.xy/vec2(uniform_tex_size.xy));
   // project to WCS
   vec4 p_ndc = vec4(2 * vec3(normalized_TexCoord.xy, depth) - 1, 1);
   vec4 p_wcs = uniform_mvp_inverse * p_ndc;
   p_wcs /= p_wcs.w;

   vec4 pos = vec4(0,0,0,1.0);
   // normalize the position to the bounding volume
   pos.xyz = (p_wcs.xyz - uniform_bbox_min) / (uniform_bbox_max - uniform_bbox_min);
   pos.xyz = 2.0 * pos.xyz - 1.0;
   gl_Position = pos;
}
