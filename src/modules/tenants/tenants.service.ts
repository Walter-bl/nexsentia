import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(tenantData: Partial<Tenant>): Promise<Tenant> {
    // Check if tenant already exists
    const existingTenant = await this.tenantRepository.findOne({
      where: [{ name: tenantData.name }, { slug: tenantData.slug }],
    });

    if (existingTenant) {
      throw new ConflictException('Tenant with this name or slug already exists');
    }

    const tenant = this.tenantRepository.create(tenantData);
    return await this.tenantRepository.save(tenant);
  }

  async findAll(): Promise<Tenant[]> {
    return await this.tenantRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findAllActive(): Promise<Tenant[]> {
    return await this.tenantRepository.find({
      where: { isActive: true },
    });
  }

  async findOne(id: number): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: number, updateData: Partial<Tenant>): Promise<Tenant> {
    const tenant = await this.findOne(id);

    // Don't allow updating id
    delete updateData.id;

    Object.assign(tenant, updateData);

    return await this.tenantRepository.save(tenant);
  }

  async remove(id: number): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.softRemove(tenant);
  }

  async softDelete(id: number): Promise<void> {
    await this.tenantRepository.softDelete(id);
  }

  async deactivate(id: number): Promise<Tenant> {
    const tenant = await this.findOne(id);
    tenant.isActive = false;
    return await this.tenantRepository.save(tenant);
  }

  async activate(id: number): Promise<Tenant> {
    const tenant = await this.findOne(id);
    tenant.isActive = true;
    return await this.tenantRepository.save(tenant);
  }
}
