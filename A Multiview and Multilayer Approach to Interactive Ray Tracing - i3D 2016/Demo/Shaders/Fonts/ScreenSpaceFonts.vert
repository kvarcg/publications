//----------------------------------------------------//
//                                                    //
// This is a free rendering engine. The library and   //
// the source code are free. If you use this code as  //
// is or any part of it in any kind of project or     //
// product, please acknowledge the source and its	  //
// author.											  //
//                                                    //
// For manuals, help and instructions, please visit:  //
// http://graphics.cs.aueb.gr/graphics/               //
//                                                    //
//----------------------------------------------------//
#version 330 core
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 texcoord;
out vec2 TexCoord;
uniform mat4 uniform_mvp;
uniform int uniform_is_shadow;
uniform vec2 uniform_shadow_dir;
uniform float uniform_shadow_size;

void main(void)
{
	vec2 p = position;
	if (uniform_is_shadow > 0)
		p.xy += uniform_shadow_dir * uniform_shadow_size;

	//p.x = -1 + position.x;
	//p.y = 1 - position.y;
   gl_Position = uniform_mvp * vec4(p.xy,0,1);
   TexCoord = texcoord;
   //TexCoord.y = 1 - TexCoord.y;	
}
