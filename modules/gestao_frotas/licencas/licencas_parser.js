/* =========================================================
   PARSER DE LICENÇAS - EXTRAÇÃO DE DADOS (REGEX)
   Isolado para facilitar a manutenção e leitura.
   ========================================================= */

window.AetParser = {
    
    // ==========================================
    // EXTRAÇÃO AET FEDERAL
    // ==========================================
    extrairAetFederal: function(textoBruto) {
        const flat = textoBruto.replace(/[\n\r\|\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
        const up = flat.toUpperCase();
        const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        const pick = (regexes, fonte = up) => {
            for (const rx of regexes) {
                const m = fonte.match(rx);
                if (m && m[1]) return m[1].replace(/\s+/g, " ").trim();
            }
            return "";
        };

        const numeroAET = pick([
            /A\.?E\.?T\.?[\s\-]*N?[ºO°]?[\s:]*([0-9]+\/[0-9]+[A-Z]?)/i,
            /AUTORIZA[ÇC][ÃA]O\s+ESPECIAL\s+DE\s+TR[ÂA]NSITO[\s\-]*N?[ºO°]?[\s:]*([0-9]+\/[0-9]+)/i
        ]);
        const conjuntoTipo = pick([
            /A\.?E\.?T\.?[\s\-]*N?[ºO°]?[\s:]*[0-9\/A-Z]+\s+([A-Z0-9\s\+]+?)\s+PROPRIET/i,
            /(TRITREM\s+\d+\s+EIXOS\s+[A-Z0-9\+]+)/
        ]);

        let proprietario = "", cnpjCpf = "";
        {
            const m1 = up.match(/PROPRIET[ÁA]RIO\s*DO\s*VE[ÍI]CULO\s+(?:CNPJ\s*\/\s*CPF\s+)?(.+?)\s+(\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
            if (m1) { proprietario = m1[1].trim(); cnpjCpf = m1[2]; }
            else {
                for (let i = 0; i < linhas.length; i++) {
                    if (/PROPRIET[ÁA]RIO\s*DO\s*VE[ÍI]CULO/.test(linhas[i].toUpperCase())) {
                        const prox = linhas[i + 1] || "";
                        const mc = prox.match(/^(.+?)\s+(\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
                        if (mc) { proprietario = mc[1].trim(); cnpjCpf = mc[2]; }
                        break;
                    }
                }
            }
        }

        let endereco = "", telefone = "";
        {
            const m1 = up.match(/ENDERE[ÇC]O\s*\([^)]*\)\s+TELEFONE\s+(.+?)\s+(\(\d{2}\)\s*[\d\s\-]+)/);
            if (m1) { endereco = m1[1].trim(); telefone = m1[2].trim(); }
            else {
                for (let i = 0; i < linhas.length; i++) {
                    if (/ENDERE[ÇC]O\s*\(/.test(linhas[i].toUpperCase())) {
                        const prox = linhas[i + 1] || "";
                        const mfone = prox.match(/(\(\d{2}\)\s*[\d\s\-]+)\s*$/);
                        if (mfone) {
                            telefone = mfone[1].trim();
                            endereco = prox.substring(0, prox.indexOf(telefone)).trim();
                        } else { endereco = prox.trim(); }
                        break;
                    }
                }
            }
        }

        let validadeInicio = "", validadeFim = "";
        {
            const m = up.match(/PER[ÍI]ODO\s+DE[:\s]+(\d{2}\/\d{2}\/\d{4})\s+A\s+(\d{2}\/\d{2}\/\d{4})/);
            if (m) { validadeInicio = m[1]; validadeFim = m[2]; }
        }

        const pbtcInformado = pick([/PBTC\s*INFORMADO\s*\(t\)[\s\|:]*([0-9.,]+)/]);
        const comprimento = pick([/COMPRIMENTO\s*\(m\)[\s\|:]*([0-9.,]+)/]);

        const linhasUteis = linhas.filter(l => {
            const u = l.toUpperCase();
            if (/^DEPARTAMENTO NACIONAL/.test(u)) return false;
            if (/^DIRETORIA DE INFRA/.test(u)) return false;
            if (/^COORDENAÇÃO GERAL/.test(u)) return false;
            if (/^RESOLUÇÃO/.test(u)) return false;
            if (/^AUTORIZAÇÃO ESPECIAL/.test(u)) return false;
            if (/^\s*$/.test(l)) return false;
            if (/^A\.E\.T\./.test(u)) return false;
            return true;
        });

        const acharLinha = (regex, inicio = 0) => {
            for (let i = inicio; i < linhasUteis.length; i++) {
                if (regex.test(linhasUteis[i].toUpperCase())) return i;
            }
            return -1;
        };

        function extrairUnidadePorValor(idxCab, tipo) {
            const blocoLinhas = [];
            for (let i = idxCab + 1; i < Math.min(idxCab + 6, linhasUteis.length); i++) {
                const u = linhasUteis[i].toUpperCase();
                if (/^UNIDADE\s+U\d+/.test(u)) break;
                if (/^PERCURSO\b/.test(u)) break;
                if (/^PLACA\s+ANO\s*FAB/i.test(u)) continue;
                if (/^TARA\s*\(t\)\s*TRA[ÇC][ÃA]O/i.test(u)) continue;
                if (/^TARA\s*\(t\)\s*RENAVAM/i.test(u)) continue;
                blocoLinhas.push(linhasUteis[i]);
            }
            
            let bloco = blocoLinhas.join(" ").toUpperCase().replace(/\s+/g, " ").trim();
            const u = {};

            const mPlaca = bloco.match(/\b([A-Z]{2,3}[0-9][A-Z0-9][0-9]{2})\b/);
            if (mPlaca) { u.placa = mPlaca[1]; bloco = bloco.replace(mPlaca[0], ""); }

            const mChassi = bloco.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
            if (mChassi) { u.chassi = mChassi[1]; bloco = bloco.replace(mChassi[0], ""); }

            const mAno = bloco.match(/\b((?:19|20)\d{2})\b/);
            if (mAno) { u.anoFab = mAno[1]; bloco = bloco.replace(mAno[0], ""); }

            const mTara = bloco.match(/\b(\d{1,2},\d{3})\b/);
            if (mTara) { u.tara = mTara[1]; bloco = bloco.replace(mTara[0], ""); }

            const tr = bloco.match(/\b(DUPLA|SIMPLES|TANDEM)\s+(\d+X\d+)\b/);
            if (tr) { u.tracao = `${tr[1]} ${tr[2]}`; bloco = bloco.replace(tr[0], ""); }

            const renavam11 = bloco.match(/\b(\d{11})\b/);
            if (renavam11) { u.renavam = renavam11[1]; bloco = bloco.replace(renavam11[0], ""); }
            else {
                const renavam10 = bloco.match(/\b(\d{10})\b/);
                if (renavam10) { u.renavam = renavam10[1]; bloco = bloco.replace(renavam10[0], ""); }
            }

            if (tipo === "u1") {
                const rntrc9 = bloco.match(/\b(\d{9})\b/);
                if (rntrc9) { u.rntrc = rntrc9[1]; bloco = bloco.replace(rntrc9[0], ""); }
            } else {
                const rntrcLetras = bloco.match(/\b(TCP|TAC|ETC|CTC)\b/);
                if (rntrcLetras) { u.rntrc = rntrcLetras[1]; bloco = bloco.replace(rntrcLetras[0], ""); }
                else {
                    const rntrcDig = bloco.match(/\b(\d{6,10})\b/g);
                    if (rntrcDig && rntrcDig.length) { 
                        u.rntrc = rntrcDig[rntrcDig.length - 1]; 
                        bloco = bloco.replace(u.rntrc, ""); 
                    }
                }
            }

            if (tipo === "u1") {
                const dir = bloco.match(/\b(HIDR[ÁA]ULICA|MEC[ÂA]NICA|EL[ÉE]TRICA)\b/);
                if (dir) { u.direcao = dir[1].charAt(0) + dir[1].slice(1).toLowerCase(); bloco = bloco.replace(dir[0], ""); }

                const bidir = bloco.match(/\b(N[ÃA]O|SIM)\s*$/);
                if (bidir) { u.bidirecional = bidir[1].charAt(0) + bidir[1].slice(1).toLowerCase(); bloco = bloco.replace(bidir[0], ""); }

                const potCmt = bloco.match(/\b(\d{2,4})\s+(\d{1,3},\d)\b/);
                if (potCmt) {
                    u.potencia = potCmt[1];
                    u.cmt = potCmt[2];
                    bloco = bloco.replace(potCmt[0], "");
                }
            } else {
                const dip = bloco.match(/\b(\d)\s+(\d)\s*$/);
                if (dip) {
                    u.numEixos = dip[1];
                    u.pneusPorEixo = dip[2];
                    bloco = bloco.replace(dip[0], "");
                }
            }

            bloco = bloco.trim().replace(/\s+/g, " ");

            const carrMatch = bloco.match(/(N[ÃA]O\s*TEM|FLORESTAL|BA[ÚU]|SIDER|GRANELEIRO|TANQUE|CA[ÇC]AMBA)/i);
            if (carrMatch) {
                u.carroceria = carrMatch[1].toUpperCase();
                bloco = bloco.replace(carrMatch[0], "").trim();
            }

            const partes = bloco.split(/\s+/);
            if (partes.length >= 2) {
                u.marca = partes[0];
                u.modelo = partes.slice(1).join(" ");
            } else if (partes.length === 1) {
                u.marca = partes[0];
                u.modelo = "";
            }

            return u;
        }

        let u1 = {};
        {
            const idxU1 = acharLinha(/^UNIDADE\s+U1\b/);
            if (idxU1 !== -1) u1 = extrairUnidadePorValor(idxU1, "u1");
        }

        let tempUnidades = [];
        for (let n = 2; n <= 6; n++) {
            const idx = acharLinha(new RegExp(`^UNIDADE\\s+U${n}\\b`));
            if (idx !== -1) {
                const u = extrairUnidadePorValor(idx, "complementar");
                if (u && (u.placa || u.chassi)) tempUnidades.push(u);
            }
        }

        let tempCarretas = [];
        const idxReboques = flat.lastIndexOf("REBOQUES E/OU SEMIRREBOQUES COMPLEMENTARES");
        if (idxReboques !== -1) {
            let blocoReboques = flat.substring(idxReboques).replace(/\|/g, " ").replace(/\s+/g, " ").trim();
            const regexCarretasGlobal = /([A-Z]{2,3}[0-9][A-Z0-9][0-9]{2})\s+(.*?)\s+((?:19|20)\d{2})\s+([A-HJ-NPR-Z0-9]{17})\s+(\d{9,11})\s+([A-Z0-9]{3,10})\s+([A-ZÀ-Ú]{4,15})\s+(\d{1,2},\d{3})\s+(\d{1,2})\s+(\d{1,2})/g;
            let match;
            
            while ((match = regexCarretasGlobal.exec(blocoReboques)) !== null) {
                let marcaModelo = match[2].trim();
                let marca = "";
                let modelo = marcaModelo;
                const marcasConhecidas = ["FACCHINI", "RANDON", "GUERRA", "LIBRELATO", "NOMA", "KRONE", "VOLVO", "SCANIA", "MERCEDES"];
                
                for (let m of marcasConhecidas) {
                    if (marcaModelo.toUpperCase().includes(m)) {
                        marca = m;
                        modelo = marcaModelo.replace(new RegExp(m, 'i'), "").trim();
                        break;
                    }
                }

                tempCarretas.push({
                    placa: match[1],
                    marca: marca || marcaModelo.split(" ")[0],
                    modelo: modelo || marcaModelo.split(" ").slice(1).join(" "),
                    anoFab: match[3],
                    chassi: match[4],
                    renavam: match[5],
                    rntrc: match[6],
                    carroceria: match[7],
                    tara: match[8],
                    numEixos: match[9],
                    pneusPorEixo: match[10]
                });
            }
        }

        let todosReboquesExtraidos = [];
        tempUnidades.forEach(u => { if(u.placa) todosReboquesExtraidos.push(u); });
        tempCarretas.forEach(c => { if(c.placa) todosReboquesExtraidos.push(c); });

        const placasVistas = new Set([u1.placa]);
        todosReboquesExtraidos = todosReboquesExtraidos.filter(r => {
            if(!r.placa || placasVistas.has(r.placa)) return false;
            placasVistas.add(r.placa);
            return true;
        });

        const unidadesComplementares = todosReboquesExtraidos.slice(0, 3);
        const carretasComplementares = todosReboquesExtraidos.slice(3);

        return {
            numeroAET, conjuntoTipo, proprietario, cnpjCpf, endereco, telefone,
            validadeInicio, validadeFim, pbtcInformado, comprimento,
            u1_placa: u1.placa || "", u1_anoFab: u1.anoFab || "", u1_chassi: u1.chassi || "",
            u1_marca: u1.marca || "", u1_modelo: u1.modelo || "", u1_carroceria: u1.carroceria || "",
            u1_tara: u1.tara || "", u1_tracao: u1.tracao || "", u1_potencia: u1.potencia || "",
            u1_cmt: u1.cmt || "", u1_direcao: u1.direcao || "", u1_renavam: u1.renavam || "",
            u1_rntrc: u1.rntrc || "", u1_bidirecional: u1.bidirecional || "",
            unidadesComplementares, carretasComplementares
        };
    },

    // ==========================================
    // EXTRAÇÃO AET ESTADUAL (COM DETECÇÃO DE BLOCO)
    // ==========================================
    extrairAetEstadual: function(textoBruto) {
        const flat = textoBruto.replace(/[\n\r\|\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
        const up = flat.toUpperCase();

        const pick = (regexes, fonte = up) => {
            for (const rx of regexes) {
                const m = fonte.match(rx);
                if (m && m[1]) return m[1].trim();
            }
            return "";
        };

        const numeroAET = pick([/\b(\d{15,16})\b/]);
        
        let validadeInicio = "", validadeFim = "";
        const mVal = textoBruto.match(/(\d{2}\/\d{2}\/\d{4})\s+AT[ÉE]\s+(\d{2}\/\d{2}\/\d{4})/i);
        if (mVal) { validadeInicio = mVal[1]; validadeFim = mVal[2]; }

        let uf = "BA"; 
        if (/ESTADO DA BAHIA/i.test(up)) uf = "BA";
        else if (/ESTADO DE MINAS GERAIS/i.test(up)) uf = "MG";
        else if (/ESP[ÍI]RITO SANTO/i.test(up)) uf = "ES";

        // ==========================================
        // EXTRAÇÃO DE CABEÇALHOS DESCONFIGURADOS 
        // ==========================================
        let contato = "";
        const mContato = textoBruto.match(/(\(\d{2}\)\s*[\d-]+\s*\/\s*[\w.-]+@[\w.-]+)/i);
        if (mContato) contato = mContato[1].trim();

        let origem = "";
        const mOrigem = textoBruto.match(/(?:^|\n)([^\n]+)\s*\n+ITINER[ÁA]RIO/i);
        if (mOrigem) origem = mOrigem[1].replace(/PROIBIDO.*/i, "").trim();

        let requerente = "", transportador = "", transportando = "TORAS", endereco = "";

        // Bloco posicional: As 4 linhas que vêm logo após o número do protocolo
        if (numeroAET) {
            const regexBloco = new RegExp(numeroAET + "\\s*\\n+([^\\n]+)\\s*\\n+([^\\n]+)\\s*\\n+([^\\n]+)\\s*\\n+((?:RUA|AV\\.|AVENIDA|ROD\\.|RODOVIA|FAZ\\.|FAZENDA).*?-\\s*[A-Z]{2})", "i");
            const mBloco = textoBruto.match(regexBloco);
            if (mBloco) {
                requerente = mBloco[1].trim();
                transportador = mBloco[2].trim();
                transportando = mBloco[3].trim();
                endereco = mBloco[4].trim();
            }
        }

        // Fallbacks caso o bloco não seja encontrado
        if (!endereco) {
            const mEnd = textoBruto.match(/(?:^|\n)((?:RUA|AV\.|AVENIDA|ROD\.|RODOVIA|FAZ\.|FAZENDA).*?-\s*[A-Z]{2})/i);
            if (mEnd) endereco = mEnd[1].trim();
        }
        if (!transportador) {
            const linhasCorp = textoBruto.match(/^.*?(?:EIRELI|LTDA|S\/?A|LOG[IÍ]STICA|TRANSPORTES|AGR[ÍI]COLA|COM[ÉE]RCIO).*$/gim) || [];
            if (linhasCorp.length >= 2) {
                requerente = linhasCorp[0].trim();
                transportador = linhasCorp[1].trim();
            }
        }

        let restricaoHorario = "Sem Restrição";
        if (/RESTRI[ÇC][ÃA]O\s+DE\s+0?8\s+HORAS/i.test(up) || /VESP[ÉE]RAS\s+DE\s+FERIADO/i.test(up)) {
            restricaoHorario = "Diurna e Noturna";
        } else if (/AMANHECER\s+AO\s+(?:POR\s+DO\s+SOL|ANOITECER)/i.test(up)) {
            restricaoHorario = "Diurna";
        } else if (/TR[ÂA]NSITO\s+DIUTURNO/i.test(up) || /24\s*HORAS/i.test(up)) {
            restricaoHorario = "Diurna e Noturna";
        } else if (/TR[ÂA]NSITO\s+NOTURNO/i.test(up) || /PER[ÍI]ODO\s+NOTURNO/i.test(up)) {
            restricaoHorario = "Noturna";
        }

        const velocidadeMax = pick([/VELOCI[D]ADE\s+(?:M[ÁA]XIMA\s+)?(?:SER[ÁA]\s+)?(?:DE\s+)?(\d+(?:[.,]\d+)?)\s*KM\s*\/\s*H/i, /AT[ÉE]\s+A\s+VELOCI[D]ADE\s+DE\s+(\d+(?:[.,]\d+)?)\s*KM\s*\/\s*H/i]);

        const marca = pick([/MARCA\s*[:\s]+\|?\s*([^|]+?)\s*\|\s*MODELO/i, /MARCA\s*:\s*(.+?)\s+MODELO/i]);
        const modelo = pick([/MODELO\s*:\s*(.+?)\s+(?:LARGURA|ANO|PLACA)/i, /MODELO\s*:\s*(.+?)(?=\s+ANO|\s+PLACA|\n|$)/i]);

        let anoFab = "", placasCavalo = "", potencia = "", placasReboquesStr = "";
        
        const mVeic = up.match(/\b(19\d{2}|20\d{2})\s+([\d.,]+)\s+([A-Z]{2,3}[0-9][A-Z0-9][0-9]{2})\s+((?:[A-Z]{2,3}[0-9][A-Z0-9][0-9]{2}\s*(?:\/\s*)?)+)\b/i);
        if (mVeic) {
            anoFab = mVeic[1];
            potencia = mVeic[2];
            placasCavalo = mVeic[3];
            placasReboquesStr = mVeic[4].replace(/[\/\|]/g, " ").replace(/\s+/g, " ").trim();
        } else {
            anoFab = pick([/ANO\s*FAB\.?\s+(\d{4})/i]);
            placasCavalo = pick([/CAVALO[\s\|]+([A-Z]{2,3}[0-9][A-Z0-9]{3})\b/i, /([A-Z]{2,3}[0-9][A-Z0-9]{3})/i]);
            placasReboquesStr = pick([/REBOQUES\s+((?:[A-Z]{2,3}[0-9][A-Z0-9]{3}\s*\/?\s*)+)/i]).replace(/[\/\|]/g, " ").replace(/\s+/g, " ").trim();
            potencia = pick([/POT[ÊE]NCIA[\s\|]+([\d,]+)/i]);
        }

        const arrReboques = placasReboquesStr.split(/\s+/).filter(Boolean);
        const placaReb1 = arrReboques[0] || "";
        const placaReb2 = arrReboques[1] || "";
        const placaReb3 = arrReboques[2] || "";

        const comprimento = pick([/COMPRIMENTO\s+DO\s+VE[ÍI]CULO[\s\|:]+(\d+[.,]?\d*)/i]);
        const pesoTotal = pick([/PESO\s+TOTAL\s+\([^)]*\)[\s\|:]+(\d+[.,]?\d*)/i, /PESO\s+TOTAL[\s\|:]+(\d+[.,]?\d*)/i]);
        const largura = pick([/LARGURA\s+DO\s+VE[ÍI]CULO[\s\|:]+(\d+[.,]?\d*)/i]);
        const peso1Unid = pick([/PESO\s+DA\s+1[ºO°ª]?\s*UNIDADE\s+DE\s+TRA[ÇC][ÃA]O[\s\|:]+(\d+[.,]?\d*)/i]);
        const altura = pick([/ALTURA\s+TOTAL[\s\|:]+(\d+[.,]?\d*)/i]);
        const larguraTotal = pick([/LARGURA\s+TOTAL[\s\|:]+(\d+[.,]?\d*)/i]);
        const pesoCarreta = pick([/PESO\s+DA\s+CARRETA[\s\|:]+(\d+[.,]?\d*)/i]);
        const pesoCarga = pick([/PESO\s+DA\s+CARGA[\s\|:]+(\d+[.,]?\d*)/i]);
        const excessoLimite = pick([/EXCESSO\s+S\/\s*LIMITE\s+[\d.,]+t[\s\|:]+(\d+[.,]?\d*)/i]);

        // Trechos
        const trechos = [];
        const mTrechos = textoBruto.match(/^(?:BA|BR|Acesso)[\s\-]*\d{3}.*$/gim);
        if (mTrechos) {
            mTrechos.forEach(t => {
                const limpo = t.trim();
                if (limpo.length > 5 && !trechos.includes(limpo)) {
                    trechos.push(limpo);
                }
            });
        }

        // Restrições (Para antes da Relação das Placas)
        const restricoes = [];
        const idxRestStr = textoBruto.indexOf("O trânsito dessa composição");
        if (idxRestStr !== -1) {
            const idxRelStr = textoBruto.indexOf("Relação das Placas");
            const fimRest = idxRelStr !== -1 ? idxRelStr : textoBruto.length;
            const bloco = textoBruto.substring(idxRestStr, fimRest);
            const frases = bloco.split(/\n/);
            frases.forEach(f => {
                const t = f.trim();
                if (t && t.length > 10) restricoes.push(t);
            });
        }
        if (/PROIBIDO O TR[ÁA]FEGO DESSE VE[ÍI]CULO NOS DIAS \d+ E \d+ DE [A-Z]+/i.test(up)) {
            restricoes.push(up.match(/PROIBIDO O TR[ÁA]FEGO DESSE VE[ÍI]CULO NOS DIAS \d+ E \d+ DE [A-Z]+/i)[0]);
        }

        // Placas Adicionais
        const placasAdicionais = [];
        for(let i = 3; i < arrReboques.length; i++) {
            if (!placasAdicionais.includes(arrReboques[i])) {
                placasAdicionais.push(arrReboques[i]);
            }
        }
        
        const todasPlacas = up.match(/\b([A-Z]{2,3}[0-9][A-Z0-9][0-9]{2})\b/g) || [];
        todasPlacas.forEach(p => {
            if (p !== placasCavalo && p !== placaReb1 && p !== placaReb2 && p !== placaReb3) {
                if (!placasAdicionais.includes(p)) {
                    placasAdicionais.push(p);
                }
            }
        });

        return {
            numeroAET, uf, transportador, cnpjCpf: "", endereco, contato, requerente,
            transportando, origem, validadeInicio, validadeFim, restricaoHorario,
            velocidadeMax, marca, modelo, anoFab, placasCavalo, 
            placaReb1, placaReb2, placaReb3,
            potencia, comprimento, pesoTotal, largura, peso1Unid, altura,
            peso2Unid: "", larguraTotal, pesoCarreta, pesoCarga, pesoAcessorios: "", excessoLimite,
            trechos, restricoes, placasAdicionais
        };
    }
};