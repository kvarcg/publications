// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the generation of the occupancy volume stage via downsampling

#version 330 core
#extension GL_EXT_gpu_shader4 : enable

layout(location = 0) out uvec4 out_voxel;

uniform usampler2D sampler_buffer;
in vec2 TexCoord;

void main(void)
{
	uvec4 result = uvec4(0u,0u,0u,0u);

	ivec2 uv = ivec2( floor( gl_FragCoord.xy ) );
	uvec4 voxel1 = texelFetch(sampler_buffer, 2 * uv, 0);
	uvec4 voxel2 = texelFetch(sampler_buffer, 2 * uv + ivec2(1, 0), 0);
	uvec4 voxel3 = texelFetch(sampler_buffer, 2 * uv + ivec2(0, 1), 0);
	uvec4 voxel4 = texelFetch(sampler_buffer, 2 * uv + ivec2(1, 1), 0);

	// merge them to one voxel
	uvec4 master_voxel = voxel1 | voxel2 | voxel3 | voxel4 ;

	// for the z axis
	uint z = 0u;
	for( uint bitPositionZ = 0u; bitPositionZ < 64u; bitPositionZ++)
	{
		// mask Z
		z = 2u*bitPositionZ;
		uint maskZ = 3u << (z%32u);
		
		// merge slice and mask
		uint partialResult = ( (master_voxel[z/32u] & maskZ) > 0u )? (1u << (bitPositionZ % 32u)) : 0u;
		result[bitPositionZ/32u] |= partialResult;
	}
	out_voxel = result;
}
