/** The demo transport keeps the HH flow testable without employer OAuth access. */
export type HhResponse = {
  externalId: string;
  firstName: string;
  lastName: string;
  email: string;
  headline: string;
};

export interface HhGateway {
  listResponses(job: { id: string; title: string }): Promise<HhResponse[]>;
}

const examples: Record<"doctor" | "sales" | "call", Array<Omit<HhResponse, "externalId" | "email"> & { slug: string }>> = {
  doctor: [
    { slug: "smirnova", firstName: "Мария", lastName: "Смирнова", headline: "Врач-стоматолог терапевт, 6 лет практики" },
    { slug: "volkov", firstName: "Андрей", lastName: "Волков", headline: "Врач-стоматолог хирург, 8 лет практики" },
  ],
  sales: [
    { slug: "kuznetsova", firstName: "Елена", lastName: "Кузнецова", headline: "Менеджер по продажам медицинских услуг" },
    { slug: "fedorov", firstName: "Дмитрий", lastName: "Фёдоров", headline: "Руководитель отдела продаж, 5 лет опыта" },
  ],
  call: [
    { slug: "ivanova", firstName: "Анна", lastName: "Иванова", headline: "Оператор контакт-центра, медицинские услуги" },
    { slug: "petrov", firstName: "Илья", lastName: "Петров", headline: "Специалист по работе с пациентами" },
  ],
};

export const mockHhGateway: HhGateway = {
  async listResponses(job) {
    const title = job.title.toLocaleLowerCase("ru");
    const category = /врач|стоматолог|хирург|терапевт|ортодонт/.test(title)
      ? "doctor" : /продаж|менеджер/.test(title) ? "sales" : "call";
    return examples[category].map((person, index) => ({
      externalId: `demo-${job.id}-${index + 1}`,
      firstName: person.firstName,
      lastName: person.lastName,
      email: `hh-demo-${job.id.slice(0, 8)}-${person.slug}@example.invalid`,
      headline: person.headline,
    }));
  },
};
