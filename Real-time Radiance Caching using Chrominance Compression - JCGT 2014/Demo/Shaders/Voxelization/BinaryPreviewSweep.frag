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

layout(location = 0) out vec4 out_color;

uniform usampler2D sampler_occupancy;

uniform vec3 uniform_bbox_min;
uniform vec3 uniform_bbox_max;
uniform uint uniform_occupancy_res_z;

in vec4 p_wcs;

void main(void)
{
	vec3 voxel_pos = (p_wcs.xyz - uniform_bbox_min) / (uniform_bbox_max - uniform_bbox_min);
	//voxel_pos.z = 1.0 - voxel_pos.z;

	int lod = 0;

	uvec4 slice = textureLod(sampler_occupancy, voxel_pos.xy, lod);
	//uint voxel_z = uint(floor((voxel_pos.z * ( uniform_occupancy_res_z >> uint(lod) ) )));
	uint voxel_z = uint(uniform_occupancy_res_z - floor((voxel_pos.z * uniform_occupancy_res_z) ) - 1);

	// get an unsigned vec4 containing the current position (marked as 1)
	uvec4 slicePos = uvec4(0u,0u,0u,0u);
	slicePos[voxel_z / 32u] = 1u << (voxel_z % 32u);
	
	// use AND to mark whether the current position has been set as occupied
	uvec4 res = slice & slicePos;

	// check if the current position is marked as occupied
	if ((res.r | res.g | res.b | res.a) > 0u) 
	{
		out_color = vec4(0,1,1,1);				
	}
	else
	{
		out_color = vec4(1,1,0,1);
	}
}
