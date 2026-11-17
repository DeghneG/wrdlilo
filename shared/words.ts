// DRAFT Hiligaynon 5-letter answers (ng counts as two letters). Needs review by a native speaker.
const RAW = `
balay tubig bugas buhay patay humay ilaga irong kamot buhok bunga ambot
dagat bukid kahoy dahon bulak banwa banig balas bulan adlaw gabii hapon
kilat bagyo linog tanom baboy manok hayop sapat kanon gatas itlog pinya
piaya suman sabaw gulay karne tiyan likod tuhod lawas balat tatay nanay
bayaw ading asawa amigo amiga hapag plato banga timba sulod gawas bulsa
paraw dalan tulay plasa lakat kadto sulat hugas palit tawag hulat hinay
dasig maayo gamay mahal dilaw berde buwas karon tanan kapoy gutom lipay
higda sakay bahin bisan kunta dapat bulig kalan panay sulog balod pilak
dagum lamok damgo kanta sayaw tatlo gwapa gwapo
`;
export const ANSWERS: string[] = Array.from(new Set(RAW.split(/\s+/).filter((w) => w.length === 5)));
