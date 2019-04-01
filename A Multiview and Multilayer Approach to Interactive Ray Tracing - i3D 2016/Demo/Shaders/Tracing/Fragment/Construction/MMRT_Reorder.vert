// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Reorder pass
// 1. The stored (unsorted) fragments are fetched, sorted and stored back in the ID buffer
// 2. The head/tail pointers are being set, reflecting the newly sorted fragments
// This pass is being called once per view
#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;
uniform mat4 uniform_mvp;			// simple projection matrix for the screen-space pass (this can be optimized out)

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
}
