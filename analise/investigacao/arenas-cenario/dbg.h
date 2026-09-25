#ifndef _DBG_H_
#define _DBG_H_
#include <stdio.h>
#include <stdint.h>
struct DbgWatch { int kind; uint32_t lo, hi; };
// kinds: 1 WRAM write, 2 WRAM read, 3 ROM read (file offset), 4 exec PC (24-bit), 5 IO write ($2100-$43FF addr)
extern FILE *dbg_fp; extern int dbg_n; extern struct DbgWatch dbg_w[32];
extern uint32_t dbg_pc; extern int dbg_dma; extern uint32_t dbg_frame; extern int dbg_trace; extern long dbg_count; extern long dbg_max;
static inline int dbg_wram_off(uint32_t a){ uint32_t b=(a>>16)&0xff, o=a&0xffff; if(b==0x7e||b==0x7f) return ((b&1)<<16)|o; if(((b&0x40)==0) && o<0x2000) return o; return -1;}
static inline int dbg_rom_off(uint32_t a){ uint32_t b=(a>>16)&0xff, o=a&0xffff; if(b>=0xC0) return ((b-0xC0)<<16)|o; if(b>=0x40&&b<0x7e) return ((b-0x40)<<16)|o; if(o>=0x8000 && (b<0x40 || (b>=0x80&&b<0xC0))) return ((b&0x3f)<<16)|o; return -1;}
void dbg_hit(int kind, uint32_t addr, uint32_t val, int size);
static inline void dbg_access(int iswrite, uint32_t a, uint32_t val, int size){
  if(!dbg_n) return;
  for(int i=0;i<dbg_n;i++){ struct DbgWatch *w=&dbg_w[i]; long k;
    if(w->kind==1 && iswrite){ k=dbg_wram_off(a); if(k>=0 && (uint32_t)k+size-1>=w->lo && (uint32_t)k<=w->hi){dbg_hit(1,a,val,size);return;} }
    else if(w->kind==2 && !iswrite){ k=dbg_wram_off(a); if(k>=0 && (uint32_t)k+size-1>=w->lo && (uint32_t)k<=w->hi){dbg_hit(2,a,val,size);return;} }
    else if(w->kind==3 && !iswrite){ k=dbg_rom_off(a); if(k>=0 && (uint32_t)k+size-1>=w->lo && (uint32_t)k<=w->hi){dbg_hit(3,a,val,size);return;} }
    else if(w->kind==5 && iswrite){ uint32_t o=a&0xffff, b=(a>>16)&0xff; if(((b&0x40)==0) && o+size-1>=w->lo && o<=w->hi){dbg_hit(5,a,val,size);return;} }
  }
}
void dbg_exec(int op);
void dbg_dmalog(int ch);
#endif
