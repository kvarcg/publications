// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the generation of the depth occupancy volume

#version 330 core
#extension GL_EXT_gpu_shader4 : enable

layout(location = 0) out uvec4 out_voxel;// 8 bit integer texture

uniform uint uniform_depth_size;

void main(void)
{
	float z = clamp(gl_FragCoord.z,0,1);
	// get an unsigned int in the range of [0, uniform_depth_size - 1];
	uint position = uint(floor(z*uniform_depth_size));

	// mark the x-th bit of the 128 bit unsinged integer as occupied
	// first find the channel in which it belongs to (each channel is 32 bit)
	// once found, use bitwise left-shifting for marking the appropriate bit
	out_voxel = uvec4(0u, 0u, 0u, 0u);
	out_voxel[position / 32u] = 1u << (position % 32u);
}
