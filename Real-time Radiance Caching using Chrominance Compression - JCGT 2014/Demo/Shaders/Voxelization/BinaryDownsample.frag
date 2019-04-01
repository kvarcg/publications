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

layout(location = 0) out uvec4 out_voxel;

uniform usampler2D sampler_buffer;
uniform uint uniform_level;
in vec2 TexCoord;

void main(void)
{
	uvec4 result = uvec4(0u,0u,0u,0u);
	ivec2 uv = ivec2( floor( gl_FragCoord.xy ) );

	uvec4 master_voxel = uvec4(0u);
	uint max_step_side = 1u << uniform_level;
	// get the texels that we will merge
	for( uint i = 0u; i < max_step_side; i++)
		for( uint j = 0u; j < max_step_side; j++)
			master_voxel |= texelFetch(sampler_buffer, int(max_step_side) * uv + ivec2(i, j), 0);

	// for the z axis
	uint z = 0u;
	uint max_bit_positionZ = 128u >> uniform_level;
	uint bit_step = 1u << uniform_level;
	for( uint bitPositionZ = 0u; bitPositionZ < max_bit_positionZ; bitPositionZ++)
	{
		// mask Z
		z = bit_step * bitPositionZ;
		uint mask_size = 2u << uniform_level;
		// fill it with aces ( e.g. 1000 - 1 = 0111 )
		mask_size--;
		uint maskZ = mask_size << (z%32u);
		
		// merge slice and mask
		uint partialResult = ( (master_voxel[z/32u] & maskZ) > 0u )? (1u << (bitPositionZ % 32u)) : 0u;
		result[bitPositionZ/32u] |= partialResult;
	}
	out_voxel = result;
}
