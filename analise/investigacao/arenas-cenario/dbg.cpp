#include "snes9x.h"
#include "memmap.h"
#include "ppu.h"
#include "dma.h"
#include "dbg.h"
FILE *dbg_fp=0; int dbg_n=0; struct DbgWatch dbg_w[32]; uint32_t dbg_pc=0; int dbg_dma=0; uint32_t dbg_frame=0; int dbg_trace=0; long dbg_count=0; long dbg_max=2000000;
static const char *KN[]={"?","WW","WR","RR","EX","IO"};
void dbg_hit(int kind, uint32_t addr, uint32_t val, int size){
  if(!dbg_fp || dbg_count>=dbg_max) return; dbg_count++;
  fprintf(dbg_fp,"%u %s pc=%06X a=%06X v=%0*X s=%d A=%04X X=%04X Y=%04X D=%04X DB=%02X\n",dbg_frame,KN[kind],dbg_pc,addr&0xffffff,size*2,val,size,
    Registers.A.W,Registers.X.W,Registers.Y.W,Registers.D.W,Registers.DB);
}
void dbg_exec(int op){
  if(!dbg_fp || dbg_count>=dbg_max) return;
  if(dbg_trace==2 && !(op==0x20||op==0x22||op==0xFC)) goto watches;
  if(dbg_trace){ dbg_count++; fprintf(dbg_fp,"%u T %06X A=%04X X=%04X Y=%04X S=%04X D=%04X DB=%02X P=%02X\n",dbg_frame,dbg_pc,Registers.A.W,Registers.X.W,Registers.Y.W,Registers.S.W,Registers.D.W,Registers.DB,Registers.PL); return; }
  watches:
  for(int i=0;i<dbg_n;i++) if(dbg_w[i].kind==4 && dbg_pc>=dbg_w[i].lo && dbg_pc<=dbg_w[i].hi){ dbg_count++;
    fprintf(dbg_fp,"%u EX %06X A=%04X X=%04X Y=%04X S=%04X D=%04X DB=%02X P=%02X\n",dbg_frame,dbg_pc,Registers.A.W,Registers.X.W,Registers.Y.W,Registers.S.W,Registers.D.W,Registers.DB,Registers.PL); return; }
}
void dbg_dmalog(int ch){
  if(!dbg_fp) return; SDMA *d=&DMA[ch];
  fprintf(dbg_fp,"%u DMA ch=%d pc=%06X rev=%d mode=%d B=21%02X A=%02X%04X n=%04X vram=%04X vinc=%02X cgadd=%02X oam=%04X fixed=%d\n",dbg_frame,ch,dbg_pc,d->ReverseTransfer,d->TransferMode,d->BAddress,d->ABank,d->AAddress,d->TransferBytes,
    PPU.VMA.Address, Memory.FillRAM[0x2115], PPU.CGADD, PPU.OAMAddr, d->AAddressFixed);
}
extern "C" {
void dbg_open(const char *p){ if(dbg_fp) fclose(dbg_fp); dbg_fp=fopen(p,"w"); dbg_count=0; }
void dbg_close(void){ if(dbg_fp){ fclose(dbg_fp); dbg_fp=0;} }
void dbg_flush(void){ if(dbg_fp) fflush(dbg_fp); }
void dbg_add(int kind, unsigned lo, unsigned hi){ if(dbg_n<32){ dbg_w[dbg_n].kind=kind; dbg_w[dbg_n].lo=lo; dbg_w[dbg_n].hi=hi; dbg_n++; } }
void dbg_clear(void){ dbg_n=0; dbg_dma=0; dbg_trace=0; }
void dbg_set_dma(int v){ dbg_dma=v; }
void dbg_set_trace(int v){ dbg_trace=v; }
void dbg_set_max(long v){ dbg_max=v; }
unsigned char *dbg_cgram(void){ static unsigned char b[512]; for(int i=0;i<256;i++){ b[2*i]=PPU.CGDATA[i]&0xff; b[2*i+1]=PPU.CGDATA[i]>>8;} return b; }
unsigned char *dbg_oam(void){ return PPU.OAMData; }
unsigned char *dbg_fillram(void){ return Memory.FillRAM; }
}
