// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the merging stage of the geometry volume

#version 330 core
#extension GL_EXT_gpu_shader4 : enable

layout(location = 0) out uvec4 out_color;
in vec2 TexCoord;
uniform usampler2DArray sampler_three_way;

uniform ivec3 uniform_size;

#define OPTIMIZED_VERSION
#define X_AXIS_LAYER 0
#define Y_AXIS_LAYER 1
#define Z_AXIS_LAYER 2

#ifndef OPTIMIZED_VERSION
// mark the x-th bit of the 128 bit unsinged integer as 'occupied'
// first find the channel in which it belongs to (each channel is 32 bit)
// once found, use bitwise left-shifting for marking the appropriate bit
// the position is passed as position + 1 for optimization purposes
uvec4 encodeBinaryVoxel(int position)
{
	// check for positioning to R channel
	position = max(position,0);
	uint voxelId1 = (position > 32 || position == 0)? 0u : 1u << uint(position - 1); 

	// check for positioning to G channel
	position -= 32; 
	position = max(position,0); 
	uint voxelId2 = (position > 32 || position == 0)? 0u : 1u << uint(position - 1); 

	// check for positioning to B channel
	position -= 32; 
	position = max(position,0); 
	uint voxelId3 = (position > 32 || position == 0)? 0u : 1u << uint(position - 1); 

	// check for positioning to A channel
	position -= 32; 
	position = max(position,0); 
	uint voxelId4 = (position > 32 || position == 0)? 0u : 1u << uint(position - 1);
	
	// save the occupancy status of the current voxel
	// the logical OR operator has been set externally so that an occupied voxel is not altered
	return uvec4(voxelId1, voxelId2, voxelId3, voxelId4);
}
#endif // OPTIMIZED_VERSION

void main(void)
{
	// get the integer coordinates of the fragment (in window relative coordinates)
	ivec2 coords = ivec2(floor(gl_FragCoord.xy));

	// first obtain the voxels for the current fragment on the XY plane
	uvec4 tex_colorZ = texelFetch(sampler_three_way, ivec3(coords.xy,Z_AXIS_LAYER),0);
	//out_color = tex_colorZ; 
	//out_color.a = 0xFFFFFFFF;
	//return;
	// this stores the final result
	uvec4 result = uvec4(0u,0u,0u,0u);
	
	// we work on the XY plane, so we parse on the Z axis
	// the loop is in the range [1, depth]  in order for the bit shifting operations to work
	// and to avoid unnecessary if's
#ifdef OPTIMIZED_VERSION
	// we work on the XY plane, so we parse on the Z axis
	for(int z = 0; z < uniform_size.z; ++z)
	{	
		// encode current z onto a uvec4 (in similar fashion to the 1st pass shader)
		uint bitPositionZ = uint(z);
		uvec4 bitZ = uvec4(0u,0u,0u,0u);
		
		// get an unsigned vec4 containing the current position (marked as 1)
		bitZ[bitPositionZ / 32u] = 1u << (bitPositionZ % 32u);
				
		// use AND to mark whether the current position has been set as occupied
		uvec4 resultZ = tex_colorZ & bitZ;

		// check if the current position is marked as occupied
		bool result_axis = (resultZ.r | resultZ.g | resultZ.b | resultZ.a) > 0u;
		
		// encode current y onto a uvec4 (in similar fashion to the 1st pass shader)
		uvec4 tex_colorY = texelFetch(sampler_three_way, ivec3(z, uniform_size.x - 1 - coords.x, Y_AXIS_LAYER), 0);
		
		uint bitPositionY = uint(uniform_size.y) - 1u - uint(coords.y);
		uvec4 bitY = uvec4(0u,0u,0u,0u);
		
		// get an unsigned vec4 containing the current position (marked as 1)
		bitY[bitPositionY / 32u] = 1u << (bitPositionY % 32u);
			
		// use AND to mark whether the current position has been set as occupied
		uvec4 resultY = tex_colorY & bitY;

		// check if the current position is marked as occupied
		result_axis = result_axis || (resultY.r | resultY.g | resultY.b | resultY.a) > 0u;
				
		// encode current x onto a uvec4 (in similar fashion to the 1st pass shader)
		uvec4 tex_colorX = texelFetch(sampler_three_way, ivec3(uniform_size.z - 1 - z, coords.y, X_AXIS_LAYER), 0);
		
		uint bitPositionX = uint(coords.x);
		uvec4 bitX = uvec4(0u,0u,0u,0u);
		
		// get an unsigned vec4 containing the current position (marked as 1)
		bitX[bitPositionX / 32u] = 1u << (bitPositionX % 32u);
					
		// use AND to mark whether the current position has been set as occupied
		uvec4 resultX = tex_colorX & bitX;

		// check if the current position is marked as occupied
		result_axis = result_axis || (resultX.r | resultX.g | resultX.b | resultX.a) > 0u;
		
		// mark current bit as occupied (bitZ is always 1)
		result |= (result_axis == true)? bitZ : uvec4(0u,0u,0u,0u);
	}
#else
	for(int z = 0; z < uniform_size.z; ++z)
	{	
		// encode current z onto a uvec4 (in similar fashion to the 1st pass shader)
		int bitPositionZ = z + 1;
		uvec4 bitZ = uvec4(0u,0u,0u,0u);
		
		// get an unsigned vec4 containing the current position (marked as 1)
		bitZ = encodeBinaryVoxel(bitPositionZ);
					
		// use AND to mark whether the current position has been set as occupied
		uvec4 resultZ = tex_colorZ & bitZ;

		// check if the current position is marked as occupied
		bool result_axis = (resultZ.r | resultZ.g | resultZ.b | resultZ.a) > 0u;
		
		// result Y
		uvec4 tex_colorY = texelFetch(sampler_three_way, ivec3(z, uniform_size.x - 1 - coords.x, Y_AXIS_LAYER), 0);
		
		int bitPositionY = uniform_size.y - 1 - coords.y;
		uvec4 bitY = uvec4(0u,0u,0u,0u);
		
		// get an unsigned vec4 containing the current position (marked as 1)
		bitY = encodeBinaryVoxel(bitPositionY + 1);
			
		// use AND to mark whether the current position has been set as occupied
		uvec4 resultY = tex_colorY & bitY;

		// check if the current position is marked as occupied
		result_axis = result_axis || (resultY.r | resultY.g | resultY.b | resultY.a) > 0u;
				
		// result X
		uvec4 tex_colorX = texelFetch(sampler_three_way, ivec3(uniform_size.z - 1 - z, coords.y, X_AXIS_LAYER), 0);
		
		int bitPositionX = coords.x + 1;
		uvec4 bitX = uvec4(0u,0u,0u,0u);
		
		// get an unsigned vec4 containing the current position (marked as 1)
		bitX = encodeBinaryVoxel(bitPositionX);
					
		// use AND to mark whether the current position has been set as occupied
		uvec4 resultX = tex_colorX & bitX;

		// check if the current position is marked as occupied
		result_axis = result_axis || (resultX.r | resultX.g | resultX.b | resultX.a) > 0u;
		
		// mark current bit as occupied (bitZ is always 1)
		result |= (result_axis == true)? bitZ : uvec4(0u,0u,0u,0u);
	}	
#endif // OPTIMIZED_VERSION

	out_color = result;
}
