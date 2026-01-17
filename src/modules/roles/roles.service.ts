import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: ['permissions'],
    });
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async findByCode(code: string): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { code },
      relations: ['permissions'],
    });
  }

  async findByIds(ids: number[]): Promise<Role[]> {
    return this.roleRepository.find({
      where: { id: In(ids) },
      relations: ['permissions'],
    });
  }

  async create(roleData: Partial<Role>): Promise<Role> {
    const role = this.roleRepository.create(roleData);
    return this.roleRepository.save(role);
  }

  async update(id: number, roleData: Partial<Role>): Promise<Role> {
    await this.roleRepository.update(id, roleData);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    const result = await this.roleRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
  }

  async getPermissionCodesForRoles(roles: Role[]): Promise<string[]> {
    const permissionCodes = new Set<string>();

    for (const role of roles) {
      if (role.permissions) {
        role.permissions.forEach((permission) => {
          if (permission.isActive) {
            permissionCodes.add(permission.code);
          }
        });
      }
    }

    return Array.from(permissionCodes);
  }
}
