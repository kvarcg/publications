// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for previewing the geometry and occupancy volumes

#version 330 core

layout(location = 0) out vec4 out_color;

in vec4 p_wcs;
flat in int ok;

void main(void)
{
	if(ok == 0) 
		out_color = vec4(0,0,1,1);
	else
		discard;
}
